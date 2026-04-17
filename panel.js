const logDiv = document.getElementById("log");
const allowedExtInput = document.getElementById("allowedExtInput");
const allowedHostsInput = document.getElementById("allowedHostsInput");
const debugDiv = document.getElementById("debug");

const seenUrls = new Map();

// --------------------
// Helpers (NO caching that breaks logic)
// --------------------

function getAllowedExtensions() {
    return allowedExtInput.value
        .split(",")
        .map(e => e.trim())
        .filter(Boolean);
}

function getAllowedHosts() {
    return allowedHostsInput.value
        .split("\n")
        .map(h => h.trim())
        .filter(Boolean);
}

function urlToFilename(url) {
    let path = url.pathname.replace(/^\/+/, "");

    path = path
        .split("/")
        .map(part => part.replace(/[\\?%*:|"<>]/g, "_"))
        .join("/");

    return path || "unnamed_file";
}

function hasAllowedExtension(url) {
    const allowedExtensions = getAllowedExtensions();
    if (allowedExtensions.length === 0) return true;

    return allowedExtensions.some(ext => url.pathname.endsWith(ext));
}

// --------------------
// Host init
// --------------------

chrome.devtools.inspectedWindow.eval(
    "window.location.hostname",
    (host, isException) => {
        if (isException || !host) {
            debugDiv.innerText = "Failed to get hostname.";
            return;
        }

        const hosts = getAllowedHosts();

        if (!hosts.includes(host)) {
            allowedHostsInput.value =
                (allowedHostsInput.value ? allowedHostsInput.value + "\n" : "") + host;
        }

        chrome.devtools.network.onRequestFinished.addListener(handleRequest);
    }
);

// --------------------
// Core handler (LOGIC UNCHANGED)
// --------------------

function handleRequest(request) {
    try {
        const url = new URL(request.request.url);

        // ALWAYS compute fresh values (preserves your original logic)
        const allowedHosts = getAllowedHosts();

        if (!allowedHosts.includes(url.hostname)) return;
        if (!hasAllowedExtension(url)) return;

        const filename = urlToFilename(url);
        if (seenUrls.has(filename)) return;

        request.getContent((body, encoding) => {
            if (!body) return;

            let content;

            // Binary-safe handling (FIXED)
            if (encoding === "base64") {
                const binary = atob(body);
                const len = binary.length;
                const bytes = new Uint8Array(len);

                for (let i = 0; i < len; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }

                content = bytes;
            } else {
                content = body;
            }

            seenUrls.set(filename, content);

            const div = document.createElement("div");
            div.className = "url";
            div.textContent = url.href;
            logDiv.appendChild(div);
        });

    } catch (err) {
        console.error("Request handling failed:", err);
        debugDiv.innerText = "Request handling error";
    }
}

// --------------------
// Clear
// --------------------

document.getElementById("clearBtn").addEventListener("click", () => {
    seenUrls.clear();
    logDiv.innerHTML = "";
    debugDiv.innerText = "";
});

// --------------------
// Download ZIP
// --------------------

document.getElementById("downloadBtn").addEventListener("click", async () => {
    if (seenUrls.size === 0) {
        debugDiv.innerText = "No URLs to download";
        return;
    }

    const zip = new JSZip();

    for (const [filename, content] of seenUrls) {
        if (content instanceof Uint8Array) {
            zip.file(filename, content, { binary: true });
        } else {
            zip.file(filename, content);
        }
    }

    try {
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "responses.zip";
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("ZIP generation failed:", err);
        debugDiv.innerText = "ZIP generation failed";
    }
});