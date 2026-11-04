function selectTicket(ticketName, ticketPrice) {
    const validPrices = {
        Regular: 2500,
        Premium: 5000,
        VIP: 10000
    };

    if (validPrices[ticketName] !== ticketPrice) {
        alert("Invalid ticket selection.");
        return;
    }

    sessionStorage.setItem("selectedTicket", ticketName);
    window.location.href = "booking.html";
}
const openingDate = new Date("2026-12-04T19:00:00+03:00").getTime();

const countdownTimer = setInterval(function () {
    const now = new Date().getTime();
    const distance = openingDate - now;

    if (distance <= 0) {
        clearInterval(countdownTimer);

        document.querySelector(".ticket-countdown").innerHTML =
            "<h2>TICKETS ARE NOW OPEN!</h2><p>Book your seat today!</p>";

        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("days").textContent = String(days).padStart(2, "0");
    document.getElementById("hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
    document.getElementById("seconds").textContent = String(seconds).padStart(2, "0");

}, 1000);
