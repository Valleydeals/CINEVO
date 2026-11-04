
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// PostgreSQL connection
if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
// Create bookings table
async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id BIGSERIAL PRIMARY KEY,
            reference VARCHAR(100) UNIQUE NOT NULL,
            customer_name VARCHAR(150) NOT NULL,
            phone VARCHAR(20) NOT NULL,
            email VARCHAR(255) NOT NULL,
            package_name VARCHAR(30) NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price INTEGER NOT NULL,
            total_amount INTEGER NOT NULL,
            payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);

    console.log("Bookings table is ready.");
}
// Test database connection
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            server: "online",
            database: "connected"
        });
    } catch (error) {
        console.error("Database connection error:", error.message);

        res.status(500).json({
            success: false,
            server: "online",
            database: "disconnected"
        });
    }
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Talanta Tickets backend is running."
    });
});

// PayHero STK Push
app.post("/api/payments/stkpush", async (req, res) => {
    try {
     const { name, email, phone, packageName, quantity } = req.body;
        if (!name || !email) {
    return res.status(400).json({
        success: false,
        message: "Customer name and email are required."
    });
        }

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

        if (
            !process.env.PAYHERO_AUTH_TOKEN ||
            !process.env.PAYHERO_CHANNEL_ID ||
            !process.env.CALLBACK_URL
        ) {
            return res.status(500).json({
                success: false,
                message: "Payment configuration is incomplete."
            });
        }

        const amount = prices[packageName] * qty;
        const reference = "MT-" + Date.now();
        await pool.query(
    `INSERT INTO bookings (
        reference,
        customer_name,
        phone,
        email,
        package_name,
        quantity,
        unit_price,
        total_amount,
        payment_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
        reference,
        name.trim(),
        phone,
        email.trim().toLowerCase(),
        packageName,
        qty,
        prices[packageName],
        amount,
        "PENDING"
    ]
);
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
                    customer_name: "Talanta Tickets Customer",
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

// Check payment status with PayHero
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

        if (response.status === 404) {
            return res.status(404).json({
                success: false,
                status: "NOT_FOUND",
                message: "No transaction was found for this reference."
            });
        }

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

// PayHero callback placeholder
app.post("/api/payments/callback", (req, res) => {
    console.log("PayHero callback received.");
    res.status(200).json({ received: true });
});

app.listen(PORT, async () => {
    console.log("Talanta Tickets backend running on port " + PORT);

    try {
        await initializeDatabase();
        await pool.query("SELECT 1");
        console.log("PostgreSQL database connected successfully.");
    } catch (error) {
        console.error("Database initialization failed:", error.message);
    }
});
