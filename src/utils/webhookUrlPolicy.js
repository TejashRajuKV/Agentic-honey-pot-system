// src/utils/webhookUrlPolicy.js
const dns = require("node:dns/promises");
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");

const blockedRanges = new net.BlockList();
const globalIpv6Ranges = new net.BlockList();
globalIpv6Ranges.addSubnet("2000::", 3, "ipv6");
[
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
    ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
    ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
    ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
].forEach(([address, prefix]) => blockedRanges.addSubnet(address, prefix, "ipv4"));

[
    ["::", 128], ["::1", 128], ["64:ff9b:1::", 48],
    ["100::", 64], ["2001::", 23], ["2001:db8::", 32], ["2002::", 16],
    ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
].forEach(([address, prefix]) => blockedRanges.addSubnet(address, prefix, "ipv6"));

function mappedIpv4Address(address) {
    const value = String(address).toLowerCase();
    if (!value.startsWith("::ffff:")) return null;

    const tail = value.slice("::ffff:".length);
    if (net.isIP(tail) === 4) return tail;

    const groups = tail.split(":");
    if (groups.length !== 2 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
    const high = parseInt(groups[0], 16);
    const low = parseInt(groups[1], 16);
    return [
        high >> 8, high & 255, low >> 8, low & 255
    ].join(".");
}

function isPublicAddress(address) {
    const family = net.isIP(address);
    if (!family) return false;
    if (family === 6) {
        const mapped = mappedIpv4Address(address);
        if (mapped) return isPublicAddress(mapped);
    }
    if (family === 6 && !globalIpv6Ranges.check(address, "ipv6")) return false;
    return !blockedRanges.check(address, family === 4 ? "ipv4" : "ipv6");
}

function isLocalHostname(hostname) {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    return host === "localhost"
        || host.endsWith(".localhost")
        || host.endsWith(".local")
        || host.endsWith(".internal")
        || host.endsWith(".lan")
        || host.endsWith(".home.arpa");
}

/**
 * Validate a webhook target before making an outbound request.
 * All DNS answers must be public addresses to reduce SSRF risk.
 * HTTP is disabled unless explicitly enabled for controlled development targets.
 */
async function validateWebhookUrl(value, options = {}) {
    const lookup = options.lookup || ((hostname) => dns.lookup(hostname, { all: true, verbatim: true }));
    const allowHttp = options.allowHttp ?? process.env.ALLOW_INSECURE_WEBHOOKS === "true";

    if (typeof value !== "string" || value.trim() === "") {
        throw new Error("Webhook URL must be a non-empty URL");
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error("Webhook URL is invalid");
    }

    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
        throw new Error("Webhook URL must use HTTPS (HTTP requires ALLOW_INSECURE_WEBHOOKS=true)");
    }
    if (url.username || url.password) {
        throw new Error("Webhook URL must not contain embedded credentials");
    }
    if (!url.hostname || isLocalHostname(url.hostname)) {
        throw new Error("Webhook URL must target a public hostname");
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const family = net.isIP(hostname);
    let addresses;
    if (family) {
        addresses = [{ address: hostname, family }];
    } else {
        try {
            addresses = await lookup(hostname);
        } catch {
            throw new Error("Webhook hostname could not be resolved");
        }
    }

    if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new Error("Webhook hostname did not resolve to an address");
    }
    if (addresses.some((entry) => !isPublicAddress(entry.address))) {
        throw new Error("Webhook URL resolves to a non-public or reserved IP address");
    }

    return url;
}

/**
 * Make a webhook request using the exact public IP that was validated.
 * Pinning the lookup used by the socket closes the validate-then-resolve DNS rebinding gap.
 */
async function requestValidatedWebhook(value, { method = "POST", headers = {}, body = "", timeoutMs = 10000 } = {}) {
    let resolvedAddresses = null;
    const lookup = async (hostname) => {
        resolvedAddresses = await dns.lookup(hostname, { all: true, verbatim: true });
        return resolvedAddresses;
    };
    const url = await validateWebhookUrl(value, { lookup });
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const literalFamily = net.isIP(hostname);
    const selected = literalFamily
        ? { address: hostname, family: literalFamily }
        : resolvedAddresses?.[0];

    if (!selected || !isPublicAddress(selected.address)) {
        throw new Error("Webhook URL did not resolve to a validated public address");
    }

    const transport = url.protocol === "https:" ? https : http;
    return new Promise((resolve, reject) => {
        const req = transport.request(url, {
            method,
            headers,
            timeout: timeoutMs,
            lookup: (_requestedHostname, options, callback) => {
                if (options?.all) callback(null, [{ address: selected.address, family: selected.family }]);
                else callback(null, selected.address, selected.family);
            },
        }, (res) => {
            res.resume();
            resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                statusText: res.statusMessage || "",
            });
        });
        req.setTimeout(timeoutMs, () => req.destroy(new Error("Webhook request timed out")));
        req.on("error", reject);
        req.end(body);
    });
}

module.exports = { isPublicAddress, isLocalHostname, validateWebhookUrl, requestValidatedWebhook };
