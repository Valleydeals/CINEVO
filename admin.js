let bookings = JSON.parse(
    localStorage.getItem("matchTicketBookings") || "[]"
);

const bookingsList = document.getElementById("admin-bookings-list");
const searchInput = document.getElementById("booking-search");

let activeStatus = "All";
let currentPage = 1;
const bookingsPerPage = 5;
let filteredBookings = [];

function formatKES(amount) {
    return "KSh " + Number(amount || 0).toLocaleString("en-KE");
}

function saveBookings() {
    localStorage.setItem(
        "matchTicketBookings",
        JSON.stringify(bookings)
    );
}

/* DASHBOARD STATISTICS */

function updateStats() {
    document.getElementById("total-bookings").textContent =
        bookings.length;

    const totalRevenue = bookings.reduce(
        (sum, booking) => sum + Number(booking.total || 0),
        0
    );

    document.getElementById("total-revenue").textContent =
        formatKES(totalRevenue);

    const totalTickets = bookings.reduce(
        (sum, booking) => sum + Number(booking.quantity || 0),
        0
    );

    document.getElementById("total-tickets").textContent =
        totalTickets;

    const pendingBookings = bookings.filter(
        booking => (booking.status || "Pending") === "Pending"
    ).length;

    document.getElementById("pending-bookings").textContent =
        pendingBookings;
}

/* DISPLAY BOOKINGS */

function displayBookings(list) {
    bookingsList.innerHTML = "";

    if (list.length === 0) {
        bookingsList.innerHTML =
            '<tr><td colspan="7">No bookings found.</td></tr>';
        return;
    }

    list.forEach(booking => {
        const row = document.createElement("tr");

        const values = [
            booking.reference || "—",
            booking.name || "—",
            booking.package || "—",
            Number(booking.quantity || 0),
            formatKES(booking.total)
        ];

        values.forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        /* STATUS DROPDOWN */

        const statusCell = document.createElement("td");
        const statusSelect = document.createElement("select");

        ["Pending", "Confirmed", "Cancelled"].forEach(status => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        });

        statusSelect.value = booking.status || "Pending";

        statusSelect.addEventListener("change", function () {
            booking.status = this.value;

            saveBookings();
            updateStats();
            applyFilters();
        });

        statusCell.appendChild(statusSelect);
        row.appendChild(statusCell);

        /* ACTION BUTTONS */

        const actionCell = document.createElement("td");

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.type = "button";
        deleteButton.style.background = "#dc2626";
        deleteButton.style.color = "white";
        deleteButton.style.border = "none";
        deleteButton.style.padding = "8px 12px";
        deleteButton.style.borderRadius = "5px";
        deleteButton.style.cursor = "pointer";

        deleteButton.addEventListener("click", function () {
            const confirmDelete = confirm(
                "Are you sure you want to delete booking " +
                (booking.reference || "") + "?"
            );

            if (!confirmDelete) return;

            bookings = bookings.filter(item => item !== booking);

            saveBookings();
            updateStats();
            applyFilters();
        });

        const viewButton = document.createElement("button");
        viewButton.textContent = "View Details";
        viewButton.type = "button";
        viewButton.style.background = "#2563eb";
        viewButton.style.color = "white";
        viewButton.style.border = "none";
        viewButton.style.padding = "8px 12px";
        viewButton.style.borderRadius = "5px";
        viewButton.style.cursor = "pointer";
        viewButton.style.marginLeft = "5px";

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
                booking.status || "Pending";

            document.getElementById("booking-modal").style.display =
                "flex";
        });

        actionCell.appendChild(deleteButton);
        actionCell.appendChild(viewButton);
        row.appendChild(actionCell);

        bookingsList.appendChild(row);
    });
}

/* SEARCH, FILTERS AND PAGINATION */

function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    filteredBookings = bookings.filter(booking => {
        const reference = String(booking.reference || "").toLowerCase();
        const name = String(booking.name || "").toLowerCase();
        const bookingStatus = booking.status || "Pending";

        const matchesSearch =
            reference.includes(searchTerm) ||
            name.includes(searchTerm);

        const matchesStatus =
            activeStatus === "All" ||
            bookingStatus === activeStatus;

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.max(
        1,
        Math.ceil(filteredBookings.length / bookingsPerPage)
    );

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * bookingsPerPage;

    const pageBookings = filteredBookings.slice(
        startIndex,
        startIndex + bookingsPerPage
    );

    displayBookings(pageBookings);

    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${totalPages}`;

    document.getElementById("previous-page").disabled =
        currentPage === 1;

    document.getElementById("next-page").disabled =
        currentPage === totalPages;
}

/* SEARCH */

searchInput.addEventListener("input", function () {
    currentPage = 1;
    applyFilters();
});

/* STATUS FILTER BUTTONS */

const filterButtons = document.querySelectorAll(".filter-btn");

filterButtons.forEach(button => {
    button.addEventListener("click", function () {
        activeStatus = this.dataset.status;
        currentPage = 1;

        filterButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        this.classList.add("active");
        applyFilters();
    });
});

/* PAGINATION BUTTONS */

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

/* CLOSE BOOKING DETAILS POPUP */

const bookingModal = document.getElementById("booking-modal");

document.getElementById("close-modal").addEventListener(
    "click",
    function () {
        bookingModal.style.display = "none";
    }
);

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

/* EXPORT BOOKINGS TO CSV */

document.getElementById("export-bookings").addEventListener(
    "click",
    function () {
        if (bookings.length === 0) {
            alert("There are no bookings to export.");
            return;
        }

        const headers = [
            "Reference",
            "Customer Name",
            "Phone",
            "Email",
            "Package",
            "Quantity",
            "Unit Price",
            "Total",
            "Status"
        ];

        function escapeCSV(value) {
            let text = String(value ?? "");

            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const rows = bookings.map(booking => [
            booking.reference || "",
            booking.name || "",
            booking.phone || "",
            booking.email || "",
            booking.package || "",
            booking.quantity || 0,
            booking.price || 0,
            booking.total || 0,
            booking.status || "Pending"
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(escapeCSV).join(","))
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "matchtickets-bookings.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }
);

/* REFRESH DASHBOARD */

document.getElementById("refresh-dashboard").addEventListener(
    "click",
    function () {
        bookings = JSON.parse(
            localStorage.getItem("matchTicketBookings") || "[]"
        );

        currentPage = 1;
        updateStats();
        applyFilters();

        alert("Dashboard refreshed successfully.");
    }
);

/* INITIAL DASHBOARD LOAD */

updateStats();
applyFilters();
