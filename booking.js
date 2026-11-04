const API_URL = "https://cinevo-backend-b246.onrender.com";

const ticketPrices = {
    Regular: 2500,
    Premium: 5000,
    VIP: 10000
};

const bookingForm = document.getElementById("booking-page-form");
const quantityInput = document.getElementById("ticket-quantity");

const packageDisplay = document.getElementById("summary-package");
const priceDisplay = document.getElementById("summary-price");
const quantityDisplay = document.getElementById("summary-quantity");
const totalDisplay = document.getElementById("summary-total");
const errorDisplay = document.getElementById("booking-error");

if (!bookingForm) {
    throw new Error("Booking form was not found.");
}

const submitButton = bookingForm.querySelector('button[type="submit"]');

const savedPackage = sessionStorage.getItem("selectedTicket");
let selectedPackage = ticketPrices[savedPackage] ? savedPackage : null;

function formatKES(amount) {
    return "KSh " + Number(amount).toLocaleString("en-KE");
}

function updateSummary() {
    const quantity = Number(quantityInput.value);
    const price = selectedPackage ? ticketPrices[selectedPackage] : 0;

    packageDisplay.textContent = selectedPackage || "Not selected";
    priceDisplay.textContent = formatKES(price);

    quantityDisplay.textContent =
        Number.isInteger(quantity) && quantity >= 1 && quantity <= 10
            ? quantity
            : "—";

    totalDisplay.textContent =
        Number.isInteger(quantity) && quantity >= 1 && quantity <= 10
            ? formatKES(price * quantity)
            : "KSh 0";
}

if (!selectedPackage) {
    errorDisplay.textContent =
        "No ticket selected. Please return to the homepage.";

    submitButton.disabled = true;
} else {
    updateSummary();
}

quantityInput.addEventListener("input", updateSummary);

function normalizePhone(phone) {
    let number = phone.replace(/\D/g, "");

    if (number.startsWith("0")) {
        number = "254" + number.substring(1);
    } else if (number.startsWith("7") || number.startsWith("1")) {
        number = "254" + number;
    }

    return number;
}

bookingForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    errorDisplay.textContent = "";

    const quantity = Number(quantityInput.value);

    const name = document.getElementById("customer-name").value.trim();
    const phone = normalizePhone(
        document.getElementById("customer-phone").value.trim()
    );
    const email = document.getElementById("customer-email").value.trim();

    if (!selectedPackage) {
        errorDisplay.textContent = "Please select a ticket package.";
        return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        errorDisplay.textContent =
            "Ticket quantity must be between 1 and 10.";
        return;
    }

    if (!name || !email) {
        errorDisplay.textContent =
            "Please enter your full name and email address.";
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorDisplay.textContent = "Enter a valid email address.";
        return;
    }

    if (!/^254[71]\d{8}$/.test(phone)) {
        errorDisplay.textContent =
            "Enter a valid Kenyan mobile number.";
        return;
    }

    const customer = {
        name,
        phone,
        email,
        package: selectedPackage,
        price: ticketPrices[selectedPackage],
        quantity,
        total: ticketPrices[selectedPackage] * quantity,
        status: "Pending Payment"
    };

    submitButton.disabled = true;
    submitButton.textContent = "Sending M-Pesa request...";

    try {
        const response = await fetch(
            API_URL + "/api/payments/stkpush",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    packageName: selectedPackage,
                    quantity
                })
            }
        );

        const responseText = await response.text();

        let result;

        try {
            result = JSON.parse(responseText);
        } catch {
            throw new Error(
                "The payment server returned an invalid response. Please try again later."
            );
        }

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Unable to initiate payment."
            );
        }

        if (!result.reference) {
            throw new Error(
                "Payment reference was not returned by the server."
            );
        }

        customer.reference = result.reference;

        sessionStorage.setItem(
            "matchTicketBooking",
            JSON.stringify(customer)
        );

        // Local browser history only.
        // PostgreSQL is the authoritative booking database.
        const existingBookings = JSON.parse(
            localStorage.getItem("matchTicketBookings") || "[]"
        );

        existingBookings.push(customer);

        localStorage.setItem(
            "matchTicketBookings",
            JSON.stringify(existingBookings)
        );

        alert(
            "M-Pesa request submitted.\n\n" +
            "Check your phone for the STK Push prompt.\n" +
            "Amount: " + formatKES(result.amount) +
            "\nReference: " + result.reference +
            "\n\nYour booking is awaiting payment verification."
        );

        window.location.href = "confirmation.html";

    } catch (error) {
        errorDisplay.textContent = error.message;

        submitButton.disabled = false;
        submitButton.textContent = "Pay Now";
    }
});
