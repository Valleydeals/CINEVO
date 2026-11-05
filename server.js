
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
// ADMIN AUTHENTICATION

const crypto = require("crypto");

function safeCompare(a, b) {
    const first = Buffer.from(String(a));
    const second = Buffer.from(String(b));

    return first.length === second.length &&
        crypto.timingSafeEqual(first, second);
}

// Verify admin username and password
app.post("/api/admin/login", (req, res) => {
    try {
        const { username, password } = req.body;

        if (!process.env.ADMIN_USERNAME ||
            !process.env.ADMIN_PASSWORD) {
            return res.status(500).json({
                success: false,
                message: "Admin credentials are not configured."
            });
        }

        const validUsername = safeCompare(
            username || "",
            process.env.ADMIN_USERNAME
        );

        const validPassword = safeCompare(
            password || "",
            process.env.ADMIN_PASSWORD
        );

        if (!validUsername || !validPassword) {
            return res.status(401).json({
                success: false,
                message: "Incorrect username or password."
            });
        }

        return res.json({
            success: true,
            message: "Admin credentials verified."
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Login service unavailable."
        });
    }
});
// ADMIN AUTHORIZATION

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Basic ")) {
        return res.status(401).json({
            success: false,
            message: "Admin authentication required."
        });
    }

    let credentials;

    try {
        credentials = Buffer.from(
            authHeader.slice(6),
            "base64"
        ).toString("utf8");
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid authentication."
        });
    }

    const separator = credentials.indexOf(":");

    if (separator < 0) {
        return res.status(401).json({
            success: false,
            message: "Invalid authentication."
        });
    }

    const username = credentials.slice(0, separator);
    const password = credentials.slice(separator + 1);

    if (
        !safeCompare(username, process.env.ADMIN_USERNAME || "") ||
        !safeCompare(password, process.env.ADMIN_PASSWORD || "")
    ) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin credentials."
        });
    }

    next();
}
// PayHero STK Push
app.post("/api/payments/stkpush", async (req, res) => {
    try {
     const { name, email, phone, packageName, quantity } = req.body;
        if (!name || !email) {
            console.log("Booking request received:", {
    name,
    email,
    phone,
    packageName,
    quantity
});
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
// ADMIN: GET BOOKINGS FROM POSTGRESQL
app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                reference,
                customer_name,
                phone,
                email,
                package_name,
                quantity,
                unit_price,
                total_amount,
                payment_status,
                created_at
            FROM bookings
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            bookings: result.rows
        });
    } catch (error) {
        console.error("Admin bookings error:", error.message);

        res.status(500).json({
            success: false,
            message: "Could not load bookings."
        });
    }
});
// ADMIN: VIEW PAYMENT RECORDS
app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                reference,
                customer_name,
                phone,
                email,
                package_name,
                quantity,
                total_amount,
                payment_status,
                payhero_reference,
                checkout_request_id,
                mpesa_receipt,
                paid_at,
                created_at
            FROM bookings
            ORDER BY
                paid_at DESC NULLS LAST,
                created_at DESC
        `);

        const summary = await pool.query(`
            SELECT
                COUNT(*) FILTER (
                    WHERE UPPER(payment_status) IN
                    ('SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID')
                ) AS successful_payments,

                COALESCE(SUM(total_amount) FILTER (
                    WHERE UPPER(payment_status) IN
                    ('SUCCESS', 'SUCCESSFUL', 'COMPLETED', 'PAID')
                ), 0) AS total_received,

                COUNT(*) FILTER (
                    WHERE UPPER(payment_status) = 'PENDING'
                ) AS pending_payments,

                COUNT(*) FILTER (
                    WHERE UPPER(payment_status) IN
                    ('FAILED', 'CANCELLED', 'CANCELED')
                ) AS failed_payments

            FROM bookings
        `);

        res.json({
            success: true,
            payments: result.rows,
            summary: summary.rows[0]
        });

    } catch (error) {
        console.error("Admin payments error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve payment records."
        });
    }
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
