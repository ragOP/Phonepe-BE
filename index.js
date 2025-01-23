const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const mongoose = require("mongoose");
const Payment = require("./payment.model");
require('dotenv').config();

const app = express();

const MERCHANT_ID = "MINDIONLINE";
const PHONE_PE_HOST_URL = "https://api.phonepe.com/apis/hermes";
const SALT_INDEX = 1;
const SALT_KEY = "027b801e-256e-4468-992c-512e1fabb424";
const APP_BE_URL = "http://localhost:8000";
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});
app.get("/pay", async function (req, res) {
  try {
    const amount = +req.query.amount;
    const { name, email, phone } = req.query;
    const userId = "MUID123";
    const merchantTransactionId = uniqid();

    const normalPayLoad = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: userId,
      amount: amount * 100,
      redirectUrl: `${APP_BE_URL}/payment/validate/${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      mobileNumber: phone,
      paymentInstrument: { type: "PAY_PAGE" },
    };

    const base64EncodedPayload = Buffer.from(
      JSON.stringify(normalPayLoad)
    ).toString("base64");
    const stringToSign = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
    const xVerifyChecksum = sha256(stringToSign) + "###" + SALT_INDEX;

    const response = await axios.post(
      `${PHONE_PE_HOST_URL}/pg/v1/pay`,
      { request: base64EncodedPayload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        },
      }
    );

    if (response.data?.data?.instrumentResponse?.redirectInfo?.url) {
      console.log(
        "Redirect >>>",
        response.data.data.instrumentResponse.redirectInfo.url
      );
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    } else {
      res.status(400).send({
        success: false,
        message: response.data?.message || "Failed to initiate payment",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

app.get("/payment/validate/:merchantTransactionId", async function (req, res) {
  try {
    const { merchantTransactionId } = req.params;

    const statusUrl = `${PHONE_PE_HOST_URL}/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
    const stringToSign =
      `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}` + SALT_KEY;
    const xVerifyChecksum = sha256(stringToSign) + "###" + SALT_INDEX;

    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerifyChecksum,
        accept: "application/json",
      },
    });

    if (response.data?.code === "PAYMENT_SUCCESS") {
      // Save payment details to the database
      const paymentData = {
        transcationId: merchantTransactionId,
        amount: response.data.data.amount / 100, // Assuming amount is in paise
        name: req.query.name, // Pass name during validation
        email: req.query.email,
        phoneNumber: req.query.phone,
      };

      const payment = new Payment(paymentData);
      await payment.save();

      res.send({
        success: true,
        message: "Payment successful and saved to database",
        data: response.data,
      });
    } else {
      res.status(400).send({
        success: false,
        message: response.data?.message || "Payment failed or pending",
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

// Start the server
const port = 8000;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});
