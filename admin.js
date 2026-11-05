
const API_URL = "https://cinevo-backend-b246.onrender.com";

// LOGIN ELEMENTS
const loginSection = document.getElementById("admin-login");
const dashboard = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("admin-login-form");
const loginMessage = document.getElementById("admin-login-message");
const loginButton = document.getElementById("admin-login-button");

// DASHBOARD ELEMENTS
const bookingsList = document.getElementById("admin-bookings-list");
const searchInput = document.getElementById("booking-search");
const bookingModal = document.getElementById("booking-modal");

let adminCredentials = null;
let bookings = [];
let filteredBookings = [];
let activeStatus = "All";
let currentPage = 1;
const bookingsPerPage = 5;

// INITIAL DISPLAY
dashboard.style.display = "none";
loginSection.style.display = "block";

// HELPERS
function formatKES(amount) {
    return "KSh " + Number(amount || 0).toLocaleString("en-KE");
}

function isPaymentSuccessful(status) {
    return ["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"]
        .includes(String(status || "").toUpperCase());
}

function displayPaymentStatus(status) {
    const value = String(status || "PENDING").toUpperCase();

    if (isPaymentSuccessful(value)) return "Confirmed";

    if (["FAILED", "CANCELLED", "CANCELED"].includes(value)) {
        return "Cancelled";
    }

    return "Pending";
}

function getAuthenticatedHeaders() {
    if (!adminCredentials) {
        throw new Error("Please log in again.");
    }

    return {
        "Authorization": "Basic " + btoa(
            adminCredentials.username + ":" + adminCredentials.password
        ),
        "Content-Type": "application/json"
    };
}

// LOAD BOOKINGS FROM POSTGRESQL
async function loadBookings() {
    const response = await fetch(
        `${API_URL}/api/admin/bookings`,
        {
            method: "GET",
            headers: getAuthenticatedHeaders()
        }
    );

    const result = await response.json();

    if (response.status === 401) {
        adminCredentials = null;
        throw new Error("Your login is no longer valid. Please log in again.");
    }

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Could not load bookings.");
    }

    bookings = (result.bookings || []).map(function (booking) {
        return {
            ...booking,
            name: booking.customer_name,
            package: booking.package_name,
            price: Number(booking.unit_price || 0),
            total: Number(booking.total_amount || 0),
            status: displayPaymentStatus(booking.payment_status),
            date: booking.created_at
        };
    });

    currentPage = 1;
    updateStats();
    applyFilters();
}

// ADMIN LOGIN
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Checking...";
    loginMessage.textContent = "";

    try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Login failed.");
        }

        // Keep credentials in memory only, not browser storage.
        adminCredentials = { username, password };

        await loadBookings();

        loginSection.style.display = "none";
        dashboard.style.display = "block";
        loginForm.reset();

    } catch (error) {
        adminCredentials = null;
        dashboard.style.display = "none";
        loginSection.style.display = "block";
        loginMessage.textContent = error.message ||
            "Unable to connect to the server.";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});

// DASHBOARD STATISTICS
function updateStats() {
    document.getElementById("total-bookings").textContent =
        bookings.length;

    // Count revenue only for payments reported successful by the backend.
    const totalRevenue = bookings.reduce(function (sum, booking) {
        return sum + (
            isPaymentSuccessful(booking.payment_status)
                ? Number(booking.total || 0)
                : 0
        );
    }, 0);

    document.getElementById("total-revenue").textContent =
        formatKES(totalRevenue);

    const totalTickets = bookings.reduce(function (sum, booking) {
        return sum + Number(booking.quantity || 0);
    }, 0);

    document.getElementById("total-tickets").textContent = totalTickets;

    const pendingBookings = bookings.filter(function (booking) {
        return booking.status === "Pending";
    }).length;

    document.getElementById("pending-bookings").textContent =
        pendingBookings;
}

// DISPLAY BOOKINGS
function displayBookings(list) {
    bookingsList.innerHTML = "";

    if (list.length === 0) {
        bookingsList.innerHTML =
            '<tr><td colspan="7">No bookings found.</td></tr>';
        return;
    }

    list.forEach(function (booking) {
        const row = document.createElement("tr");

        const values = [
            booking.reference || "—",
            booking.name || "—",
            booking.package || "—",
            Number(booking.quantity || 0),
            formatKES(booking.total),
            booking.status
        ];

        values.forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actionCell = document.createElement("td");

        const viewButton = document.createElement("button");
        viewButton.textContent = "View Details";
        viewButton.type = "button";
        viewButton.style.background = "#2563eb";
        viewButton.style.color = "white";
        viewButton.style.border = "none";
        viewButton.style.padding = "8px 12px";
        viewButton.style.borderRadius = "5px";
        viewButton.style.cursor = "pointer";

        viewButton.addEventListener("click", function () {
            document.getElementById("detail-reference").textContent =
                booking.reference || "—";

            document.getElementById("detail-name").textContent =
                booking.name || "—";

            document.getElementById("detail-phone").textContent =
                booking.phone || "—";

            document.getElementById("detail-email").textContent =
                booking.email || "—";

            document.getElementById("detail-package").textContent =
                booking.package || "—";

            document.getElementById("detail-quantity").textContent =
                Number(booking.quantity || 0);

            document.getElementById("detail-total").textContent =
                formatKES(booking.total);

            document.getElementById("detail-status").textContent =
                booking.status;

            bookingModal.style.display = "flex";
        });

        actionCell.appendChild(viewButton);
        row.appendChild(actionCell);
        bookingsList.appendChild(row);
    });
}

// SEARCH, FILTERS AND PAGINATION
function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    filteredBookings = bookings.filter(function (booking) {
        const reference = String(booking.reference || "").toLowerCase();
        const name = String(booking.name || "").toLowerCase();
        const phone = String(booking.phone || "").toLowerCase();

        const matchesSearch =
            reference.includes(searchTerm) ||
            name.includes(searchTerm) ||
            phone.includes(searchTerm);

        const matchesStatus =
            activeStatus === "All" || booking.status === activeStatus;

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.max(
        1,
        Math.ceil(filteredBookings.length / bookingsPerPage)
    );

    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * bookingsPerPage;
    const pageBookings = filteredBookings.slice(
        startIndex,
        startIndex + bookingsPerPage
    );

    displayBookings(pageBookings);

    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${totalPages}`;

    document.getElementById("previous-page").disabled =
        currentPage <= 1;

    document.getElementById("next-page").disabled =
        currentPage >= totalPages;
}

// SEARCH
searchInput.addEventListener("input", function () {
    currentPage = 1;
    applyFilters();
});

// STATUS FILTER BUTTONS
document.querySelectorAll(".filter-btn").forEach(function (button) {
    button.addEventListener("click", function () {
        activeStatus = this.dataset.status || "All";
        currentPage = 1;

        document.querySelectorAll(".filter-btn").forEach(function (item) {
            item.classList.remove("active");
        });

        this.classList.add("active");
        applyFilters();
    });
});

// PAGINATION
document.getElementById("previous-page").addEventListener(
    "click",
    function () {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
        }
    }
);

document.getElementById("next-page").addEventListener(
    "click",
    function () {
        const totalPages = Math.max(
            1,
            Math.ceil(filteredBookings.length / bookingsPerPage)
        );

        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
        }
    }
);

// CLOSE BOOKING DETAILS
document.getElementById("close-modal").addEventListener("click", function () {
    bookingModal.style.display = "none";
});

document.getElementById("close-details-button").addEventListener(
    "click",
    function () {
        bookingModal.style.display = "none";
    }
);

bookingModal.addEventListener("click", function (event) {
    if (event.target === bookingModal) {
        bookingModal.style.display = "none";
    }
});

// EXPORT BOOKINGS TO CSV
document.getElementById("export-bookings").addEventListener(
    "click",
    function () {
        if (bookings.length === 0) {
            alert("There are no bookings to export.");
            return;
        }

        const headers = [
            "Reference", "Customer Name", "Phone", "Email",
            "Package", "Quantity", "Unit Price", "Total",
            "Payment Status", "Created At"
        ];

        function escapeCSV(value) {
            let text = String(value ?? "");

            // Prevent spreadsheet formula injection.
            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const rows = bookings.map(function (booking) {
            return [
                booking.reference,
                booking.name,
                booking.phone,
                booking.email,
                booking.package,
                booking.quantity,
                booking.price,
                booking.total,
                booking.payment_status,
                booking.date
            ];
        });

        const csvContent = [headers, ...rows]
            .map(function (row) {
                return row.map(escapeCSV).join(",");
            })
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "talanta-tickets-bookings.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }
);

// REFRESH FROM POSTGRESQL
document.getElementById("refresh-dashboard").addEventListener(
    "click",
    async function () {
        const button = this;
        button.disabled = true;
        button.textContent = "Refreshing...";

        try {
            await loadBookings();
            alert("Bookings refreshed from the database.");
        } catch (error) {
            alert("Refresh failed: " + error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Refresh";
        }
    }
);
// THREE-DOT ADMIN MENU

const menuButton = document.getElementById("admin-menu-button");
const menuDropdown = document.getElementById("admin-menu-dropdown");

menuButton.addEventListener("click", function () {
    menuDropdown.classList.toggle("open");

    menuButton.setAttribute(
        "aria-expanded",
        menuDropdown.classList.contains("open") ? "true" : "false"
    );
});

// CLOSE MENU WHEN CLICKING OUTSIDE
document.addEventListener("click", function (event) {
    if (!event.target.closest(".admin-menu")) {
        menuDropdown.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
    }
});

// MENU LOGOUT
document.getElementById("menu-logout").addEventListener("click", function () {
    adminCredentials = null;

    dashboard.style.display = "none";
    loginSection.style.display = "block";

    loginMessage.textContent = "";
    loginForm.reset();

    menuDropdown.classList.remove("open");
});
