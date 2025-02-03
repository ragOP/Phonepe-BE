const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const mongoose = require("mongoose");
const Payment = require("./payment.model");
const buttonClick = require("./button.models");
const websiteVisit = require("./website.models");
const crypto = require("crypto-js");
require("dotenv").config();

const app = express();

const MERCHANT_ID = "MINDIONLINE";
const PHONE_PE_HOST_URL = "https://api.phonepe.com/apis/hermes";
const SALT_INDEX = 1;
const SALT_KEY = "027b801e-256e-4468-992c-512e1fabb424";
const APP_BE_URL = "https://phonepe-be.onrender.com";
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: false }));

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

app.post('/create-order', async (req, res) => {
    try {
        const { amount, currency, receipt } = req.body;

        const response = await axios.post('https://api.razorpay.com/v1/orders', {
            amount,
            currency,
            receipt,
            payment_capture: 1
        }, {
            auth: {
                username: RAZORPAY_KEY_ID,
                password: RAZORPAY_SECRET
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error("Razorpay Order Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create order" });
    }
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
      redirectUrl: `${APP_BE_URL}/payment/validate/${merchantTransactionId}?name=${name}&email=${email}&phone=${phone}&amount=${amount}`,
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
  const { merchantTransactionId } = req.params;
  
  const URL = `https://apps-uat.phonepe.com/v3/transaction/${MERCHANT_ID}/${merchantTransactionId}/status`;
  
  const stringToSign = `/v3/transaction/${MERCHANT_ID}/${merchantTransactionId}/status${SALT_KEY}`;
  const xVerifyChecksum = sha256(stringToSign) + '###' + SALT_INDEX;

  const options = {
    method: "GET",
    url: URL,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": xVerifyChecksum,
      "X-MERCHANT-ID": MERCHANT_ID,
    },
  };

  // console.log("Generated URL:", URL);
  // console.log("String to Sign:", stringToSign);
  // console.log("X-Verify Checksum:", xVerifyChecksum);

  try {
    const response = await axios.request(options);
    console.log("API Response:", response.data);

    if (response.data && response.data.data && response.data.data.responseCode === "SUCCESS") {
      const paymentData = {
        transactionId: merchantTransactionId,
        amount: req.query.amount || 0,
        name: req.query.name || "Unknown",
        email: req.query.email || "No Email",
        phoneNumber: req.query.phone || "No Phone",
      };

      console.log("Payment Details:", paymentData);

      const payment = new Payment(paymentData);
      await payment.save();

      return res.redirect(
        `https://www.mindinfi.in/thankyou.html?transaction_Id=${merchantTransactionId}`
      );
    } else {
      console.error("Payment failed:", response.data?.data);
      return res.status(400).send({
        success: false,
        message: "Payment failed",
      });
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    const errorMessage = error.response?.data?.message || error.message || "Internal Server Error";

    return res.status(500).send({
      success: false,
      message: errorMessage,
    });
  }
});

app.post("/api/user/click", async (req, res) => {
  try {
    const { buttonId } = req.body;
    const response = await buttonClick.findOne({ buttonId });
    if (response) {
      await buttonClick.updateOne({ buttonId }, { $inc: { clicked: 1 } });
    } else {
      await buttonClick.create({
        buttonId,
        clicked: 1,
      });
    }
    res.status(200).send({
      success: true,
      message: "Button clicked successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

app.post("/api/user/website/visit", async (req, res) => {
  try {
    const { websiteId } = req.body;
    const response = await websiteVisit.findOne({ websiteId });
    if (response) {
      await websiteVisit.updateOne({ websiteId }, { $inc: { visited: 1 } });
    } else {
      await websiteVisit.create({
        websiteId,
        visited: 1,
      });
    }
    res.status(200).send({
      success: true,
      message: "Website visited successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

app.get("/api/admin/get-all-payments", async (req, res) => {
  try {
    const payments = await Payment.find({});
    res.status(200).send({
      success: true,
      data: payments,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

app.get("/api/admin/get-all-website-views", async (req, res) => {
  try {
    const payments = await websiteVisit.find({});
    res.status(200).send({
      success: true,
      data: payments,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

app.get("/api/admin/get-all-button-views", async (req, res) => {
  try {
    const payments = await buttonClick.find({});
    res.status(200).send({
      success: true,
      data: payments,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});
