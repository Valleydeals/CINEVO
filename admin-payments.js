
const API_URL = "https://cinevo-backend-b246.onrender.com";

const message = document.getElementById("message");
const paymentsList = document.getElementById("payments-list");
const searchInput = document.getElementById("payment-search");
const filterInput = document.getElementById("payment-filter");

let adminCredentials = null;
let payments = [];

function formatKES(amount) {
    return "KSh " + Number(amount || 0).toLocaleString("en-KE");
}

function getStatus(status) {
    const value = String(status || "PENDING").toUpperCase();

    if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(value)) {
        return "Successful";
    }

    if (["FAILED", "CANCELLED", "CANCELED"].includes(value)) {
        return "Failed";
    }

    return "Pending";
}

function getAuthHeaders() {
    if (!adminCredentials) {
        throw new Error("Please log in again.");
    }

    return {
        Authorization: "Basic " + btoa(
            adminCredentials.username + ":" + adminCredentials.password
        )
    };
}

// ADMIN LOGIN
async function login() {
    const username = prompt("Enter admin username:");
    if (username === null) return;

    const password = prompt("Enter admin password:");
    if (password === null) return;

    message.textContent = "Verifying administrator...";

    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username.trim(),
                password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Login failed.");
        }

        adminCredentials = {
            username: username.trim(),
            password
        };

        await loadPayments();

    } catch (error) {
        adminCredentials = null;
        message.textContent = error.message;
    }
}

// LOAD PAYMENTS FROM POSTGRESQL
async function loadPayments() {
    message.textContent = "Loading payment records...";

    try {
        const response = await fetch(
            `${API_URL}/api/admin/payments`,
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        const result = await response.json();

        if (response.status === 401) {
            adminCredentials = null;
            throw new Error("Admin authentication expired. Please log in again.");
        }

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Could not load payments.");
        }

        payments = result.payments || [];

        updateSummary(result.summary || {});
        renderPayments();

        message.textContent =
            `Loaded ${payments.length} payment records from the database.`;

    } catch (error) {
        message.textContent = error.message;
        paymentsList.innerHTML =
            '<tr><td colspan="9">Unable to load payments.</td></tr>';
    }
}

// SUMMARY
function updateSummary(summary) {
    document.getElementById("successful-payments").textContent =
        Number(summary.successful_payments || 0);

    document.getElementById("total-received").textContent =
        formatKES(summary.total_received);

    document.getElementById("pending-payments").textContent =
        Number(summary.pending_payments || 0);

    document.getElementById("failed-payments").textContent =
        Number(summary.failed_payments || 0);
}

// DISPLAY PAYMENTS
function renderPayments() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedStatus = filterInput.value;

    const filtered = payments.filter(payment => {
        const status = getStatus(payment.payment_status);

        const searchableText = [
            payment.customer_name,
            payment.phone,
            payment.reference,
            payment.payhero_reference,
            payment.mpesa_receipt,
            payment.email
        ].join(" ").toLowerCase();

        const matchesSearch = searchableText.includes(search);

        const matchesStatus =
            selectedStatus === "All" ||
            selectedStatus === status;

        return matchesSearch && matchesStatus;
    });

    paymentsList.innerHTML = "";

    if (filtered.length === 0) {
        paymentsList.innerHTML =
            '<tr><td colspan="9">No matching payments found.</td></tr>';
        return;
    }

    filtered.forEach(payment => {
        const row = document.createElement("tr");

        const status = getStatus(payment.payment_status);

        const values = [
            payment.customer_name || "—",
            payment.phone || "—",
            payment.reference || "—",
            payment.payhero_reference || "—",
            payment.package_name || "—",
            formatKES(payment.total_amount),
            payment.mpesa_receipt || "Not available",
            status,
            payment.paid_at
                ? new Date(payment.paid_at).toLocaleString("en-KE")
                : "Not paid"
        ];

        values.forEach((value, index) => {
            const cell = document.createElement("td");

            if (index === 7) {
                const badge = document.createElement("span");
                badge.className = "status " +
                    (status === "Successful" ? "success" :
                    status === "Failed" ? "failed" : "pending");

                badge.textContent = status;
                cell.appendChild(badge);
            } else {
                cell.textContent = value;
            }

            row.appendChild(cell);
        });

        paymentsList.appendChild(row);
    });
}

// SEARCH AND FILTER
searchInput.addEventListener("input", renderPayments);
filterInput.addEventListener("change", renderPayments);

// REFRESH
document.getElementById("refresh-payments").addEventListener(
    "click",
    async function () {
        await loadPayments();
    }
);

// EXPORT CSV
document.getElementById("export-payments").addEventListener(
    "click",
    function () {
        if (payments.length === 0) {
            alert("No payment records to export.");
            return;
        }

        const headers = [
            "Customer",
            "Phone",
            "Booking Reference",
            "PayHero Reference",
            "Package",
            "Quantity",
            "Amount",
            "M-Pesa Receipt",
            "Payment Status",
            "Payment Date"
        ];

        function escapeCSV(value) {
            let text = String(value ?? "");

            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const rows = payments.map(payment => [
            payment.customer_name,
            payment.phone,
            payment.reference,
            payment.payhero_reference,
            payment.package_name,
            payment.quantity,
            payment.total_amount,
            payment.mpesa_receipt,
            payment.payment_status,
            payment.paid_at
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(escapeCSV).join(","))
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "talanta-tickets-payments.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
);

// START
login();
