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
  try {
    const { merchantTransactionId } = req.params;

    console.log(merchantTransactionId, "Merchant Transaction");

    const paymentData = {
      transcationId: merchantTransactionId,
      amount: req.query.amount,
      name: req.query.name,
      email: req.query.email,
      phoneNumber: req.query.phone,
    };

    console.log(paymentData, "Payment details");

    const payment = new Payment(paymentData);
    await payment.save();

    return res.redirect(
      `https://www.mindinfi.in/success.html?transaction_Id=${merchantTransactionId}`
    );
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});
app.post('/api/user/click', async (req, res) => {
  try {
    const { buttonId } = req.body;
    const response = await buttonClick.findOne({buttonId});
    if(response){
      await buttonClick.updateOne({buttonId}, {$inc: {clicked: 1}})
    }else{
      await buttonClick.create({
        buttonId,
        clicked: 1,
      })
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
})

app.post('/api/user/website/visit', async (req, res) => {
  try {
    const { websiteId } = req.body;
    const response = await websiteVisit.findOne({websiteId});
    if(response){
      await websiteVisit.updateOne({websiteId}, {$inc: {visited: 1}})
    }else{
      await websiteVisit.create({
        websiteId,
        visited: 1,
      })
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
})

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});
