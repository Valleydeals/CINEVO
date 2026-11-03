
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "MatchTickets backend is running."
    });
});

app.post("/api/payments/stkpush", async (req, res) => {
    try {
        const { phone, packageName, quantity } = req.body;

        const prices = {
            Regular: 2500,
            Premium: 5000,
            VIP: 10000
        };

        if (!phone || !/^(2547|2541)\d{8}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid Kenyan phone number."
            });
        }

        if (!prices[packageName]) {
            return res.status(400).json({
                success: false,
                message: "Invalid ticket package."
            });
        }

        const qty = Number(quantity);

        if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be between 1 and 10."
            });
        }

        if (!process.env.PAYHERO_AUTH_TOKEN ||
            !process.env.PAYHERO_CHANNEL_ID ||
            !process.env.CALLBACK_URL) {
            return res.status(500).json({
                success: false,
                message: "Payment configuration is incomplete."
            });
        }

        const amount = prices[packageName] * qty;
        const reference = "MT-" + Date.now();

        const response = await fetch(
            "https://backend.payhero.co.ke/api/v2/payments",
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Basic " + process.env.PAYHERO_AUTH_TOKEN,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    amount,
                    phone_number: phone,
                    channel_id: Number(process.env.PAYHERO_CHANNEL_ID),
                    provider: "m-pesa",
                    external_reference: reference,
                    customer_name: "MatchTickets Customer",
                    callback_url: process.env.CALLBACK_URL
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error("PayHero error:", result);

            return res.status(502).json({
                success: false,
                message: "Unable to initiate payment."
            });
        }

        res.json({
            success: true,
            message: "STK Push request submitted.",
            reference,
            amount,
            payment: result
        });

    } catch (error) {
        console.error("Payment error:", error.message);

        res.status(500).json({
            success: false,
            message: "Payment service unavailable."
        });
    }
});
// Check payment status directly with PayHero
app.get("/api/payments/status/:reference", async (req, res) => {
    try {
        const reference = req.params.reference;

        if (!reference || !/^MT-\d+$/.test(reference)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment reference."
            });
        }

        if (!process.env.PAYHERO_AUTH_TOKEN) {
            return res.status(500).json({
                success: false,
                message: "Payment configuration is incomplete."
            });
        }

        const response = await fetch(
            "https://backend.payhero.co.ke/api/v2/transaction-status?reference=" +
            encodeURIComponent(reference),
            {
                method: "GET",
                headers: {
                    Authorization:
                        "Basic " + process.env.PAYHERO_AUTH_TOKEN,
                    "Content-Type": "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            console.error("PayHero status error:", result);

            return res.status(502).json({
                success: false,
                message: "Unable to check payment status."
            });
        }

        return res.json({
            success: true,
            payment: result
        });

    } catch (error) {
        console.error("Status check error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Payment status service unavailable."
        });
    }
});
app.post("/api/payments/callback", (req, res) => {
    console.log("PayHero callback received.");
    res.status(200).json({ received: true });
});

app.listen(PORT, () => {
    console.log("MatchTickets backend running on port " + PORT);
});
