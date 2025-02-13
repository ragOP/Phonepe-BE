const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const Razorpay = require("razorpay");
const uniqid = require("uniqid");
const mongoose = require("mongoose");
const Payment = require("./payment.model");
const buttonClick = require("./button.models");
const sessionModel = require("./session.model");
const websiteVisit = require("./website.models");
const crypto = require("crypto-js");
require("dotenv").config();
const requestIp = require("request-ip");

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
  .then(() => {
  //   console.log(await buttonClick.collection.getIndexes());
  // await buttonClick.collection.dropIndex("buttonId_1");
  // console.log("Index dropped successfully!");
    console.log("MongoDB connected")
  })
  .catch((err) => console.error("MongoDB connection error:", err));
app.get("/", (req, res) => {
  res.send("PhonePe Integration APIs!");
});

// const fetch = require('node-fetch');  // Import fetch for making requests

app.post("/conversion", async (req, res) => {
  try {
    const { websiteId } = req.body;

    // First, log the website visit
    const response = await websiteVisit.findOne({ websiteId });
    if (response) {
      await websiteVisit.updateOne({ websiteId }, { $inc: { visited: 1 } });
    } else {
      await websiteVisit.create({
        websiteId,
        visited: 1,
      });
    }

    // After logging the visit, send data to Meta Conversion API
    const eventData = {
      event_name: "PageView", // You can change this based on the event you are tracking
      event_time: Math.floor(Date.now() / 1000),
    };

    // Send the event to Meta Conversion API
    const metaResponse = await fetch(
      "https://graph.facebook.com/v12.0/1250755309554196/events",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Bearer EAAM5bcGZB3OUBO2WXFsW4xeNgsUgrMPrSs3MUGufChTTbgpnBFrqtZBZCkQzHZAeC2nGP21aLMtxFFX2CAOsQNkkrfH2T4QBiIyD9fqZBnAqfsZBZBYfV6dZANXnSdm77tokpWjBhPXWciMz8ZB5H75ZA4p31hL7n0pyKtsxyQ6VRsZBvja6ZBqhUE3zJuFx5TMBEEQqNgZDZD", // Use a valid access token
        },
        body: JSON.stringify({
          data: [eventData],
        }),
      }
    );

    const result = await metaResponse.json();

    if (metaResponse.ok) {
      // If the request to Conversion API is successful, return a success response
      res.status(200).send({
        success: true,
        message:
          "Website visited successfully and event sent to Conversion API",
        metaResponse: result, // Optionally return Meta response for debugging
      });
    } else {
      // If the request to Conversion API fails, return an error response
      res.status(500).send({
        success: false,
        message: "Failed to send event to Meta Conversion API",
        error: result,
      });
    }
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

const razorpay = new Razorpay({
  key_id: "rzp_live_FcQBR1DILzKVXo",
  key_secret: "jyZ8k3KCsj4WqW8b0NUrtQxj", // Razorpay Key Secret (Backend only)
});

app.post("/create-order", async (req, res) => {
  const { amount, currency, receipt } = req.body;

  try {
    // Create an order with Razorpay on the server-side
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise (Razorpay expects the amount in paise)
      currency: currency,
      receipt: receipt,
      payment_capture: 1, // Auto-capture payment
    });

    // Send back the order details to the frontend
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ error: "Order creation failed" });
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
  const xVerifyChecksum = sha256(stringToSign) + "###" + SALT_INDEX;

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

    if (
      response.data &&
      response.data.data &&
      response.data.data.responseCode === "SUCCESS"
    ) {
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
    const errorMessage =
      error.response?.data?.message || error.message || "Internal Server Error";

    return res.status(500).send({
      success: false,
      message: errorMessage,
    });
  }
});

app.post("/api/user/click", async (req, res) => {
  try {
    let { websiteId, buttonId } = req.body;
    const clientIp = requestIp.getClientIp(req);

    if (!websiteId || buttonId === undefined || buttonId === null) {
      return res.status(400).send({
        success: false,
        message: "websiteId and buttonId are required",
      });
    }

    if (![1, 2, 3, 4, 5].includes(buttonId)) {
      return res.status(400).send({
        success: false,
        message: "Invalid buttonId. It must be between 1 and 5.",
      });
    }

    let websiteButtons = await buttonClick.findOne({ websiteId });

    if (!websiteButtons) {
      await buttonClick.create({
        websiteId,
        buttons: [{ buttonId, clicked: 1, ipAddresses: [clientIp] }],
      });
      return res.status(201).send({
        success: true,
        message: `Button ${buttonId} clicked successfully`,
        data: { websiteId, buttons: [{ buttonId, clicked: 1, ipAddresses: [clientIp] }] },
      });
    }

    const buttonIndex = websiteButtons.buttons.findIndex(
      (btn) => btn.buttonId === buttonId
    );

    if (buttonIndex === -1) {
      await buttonClick.updateOne(
        { websiteId },
        { $push: { buttons: { buttonId, clicked: 1, ipAddresses: [clientIp] } } }
      );
    } else {
      const existingButton = websiteButtons.buttons[buttonIndex];

      if (existingButton.ipAddresses.includes(clientIp)) {
        return res.status(400).send({
          success: false,
          message: "User has already clicked this button",
        });
      }

      // If IP is new, update click count and store IP
      await buttonClick.updateOne(
        { websiteId, "buttons.buttonId": buttonId },
        { 
          $inc: { "buttons.$.clicked": 1 },
          $push: { "buttons.$.ipAddresses": clientIp }
        }
      );
    }

    const finalResponse = await buttonClick.findOne({ websiteId });

    res.status(200).send({
      success: true,
      message: `Button ${buttonId} clicked successfully`,
      data: finalResponse,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
});

app.get("/api/test", async (req, res) => {
  try {
    const websites = await buttonClick.find({});
    res.status(200).send({
      success: true,
      data: websites,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
});

app.get("/api/get-all-visits", async (req, res) => {
  try {
    const visits = await websiteVisit.find({});
    res.status(200).send({
      success: true,
      data: visits,
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
    const { websiteId, websiteName } = req.body;
    const clientIp = requestIp.getClientIp(req);

    if (!websiteId || !websiteName) {
      return res.status(400).send({
        success: false,
        message: "websiteId and websiteName are required",
      });
    }

    const existingVisit = await websiteVisit.findOne({ websiteId });

    const existingUser = await websiteVisit.findOne({
      websiteId,
    });

    if (existingUser) {
      const existingUserIpAddresses = existingUser.userIpAddress;

      if (existingUserIpAddresses.includes(clientIp)) {
        return res
          .status(404)
          .send({ message: "User visited for this website" });
      }
    }

    if (existingVisit) {
      await websiteVisit.updateOne(
        { websiteId },
        { $push: { userIpAddress: clientIp } },
        { $inc: { visited: 1 }, $set: { websiteName } }
      );
    } else {
      await websiteVisit.create({
        websiteId,
        websiteName,
        visited: 1,
        userIpAddress: [clientIp],
      });
    }

    res.status(200).send({
      success: true,
      message: "Website visited successfully",
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Internal Server Error",
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
    const websiteVisits = await websiteVisit.find({});

    const websiteStats = await Promise.all(
      websiteVisits.map(async (visit) => {
        const buttonData = await buttonClick.findOne({
            websiteId: visit.websiteId,
            // date: visit.createdAt.toISOString().split('T')[0], 
            date: new Date().toLocaleDateString(),
          websiteId: visit.websiteId,
        });

        const buttonClicks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        if (buttonData?.buttons) {
          buttonData.buttons.forEach((btn) => {
            if ([1, 2, 3, 4, 5].includes(btn.buttonId)) {
              buttonClicks[btn.buttonId] = btn.clicked;
            }
          });
        }

        const totalVisits = visit.userIpAddress.length;

        console.log(totalVisits, "added");
        const fifthButtonClicks = buttonClicks[5];

        const conversionPercentage =
          fifthButtonClicks > 0
            ? ((fifthButtonClicks / totalVisits) * 100).toFixed(2)
            : 0;

        // console.log(conversionPercentage, "converted");

        return {
          websiteId: visit.websiteId,
          totalVisits,
          conversionPercentage: `${conversionPercentage}%`,
          buttonClicks,
          websiteName: visit.websiteName,
        };
      })
    );

    res.status(200).send({
      success: true,
      data: websiteStats,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
});


app.get("/api/admin/get-all-website-views1", async (req, res) => {
  try {
    const websiteVisits = await websiteVisit.find({});

    const websiteStats = await Promise.all(
      websiteVisits.map(async (visit) => {
        const buttonData = await buttonClick.findOne({
            websiteId: visit.websiteId,
            // date: visit.createdAt.toISOString().split('T')[0], 
            date: new Date().toLocaleDateString(),
          websiteId: visit.websiteId,
        });

        const buttonClicks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        if (buttonData?.buttons) {
          buttonData.buttons.forEach((btn) => {
            if ([1, 2, 3, 4, 5].includes(btn.buttonId)) {
              buttonClicks[btn.buttonId] = btn.clicked;
            }
          });
        }

        const totalVisits = visit.userIpAddress.length;

        console.log(totalVisits, "added");
        const fifthButtonClicks = buttonClicks[5];

        const conversionPercentage =
          fifthButtonClicks > 0
            ? ((fifthButtonClicks / totalVisits) * 100).toFixed(2)
            : 0;

        // console.log(conversionPercentage, "converted");

        return {
          websiteId: visit.websiteId,
          totalVisits,
          conversionPercentage: `${conversionPercentage}%`,
          buttonClicks,
          websiteName: visit.websiteName,
          date: new Date().toLocaleDateString(),
        };
      })
    );

    res.status(200).send({
      success: true,
      data: websiteStats,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
});

app.get("/api/admin/get-all-website-views2", async (req, res) => {
  try {
    const websiteVisits = await websiteVisit.find({});

    const websiteStats = await Promise.all(
      websiteVisits.map(async (visit) => {
        const buttonData = await buttonClick.findOne({
            websiteId: visit.websiteId,
            // date: visit.createdAt.toISOString().split('T')[0], 
            date: new Date().toLocaleDateString(),
          websiteId: visit.websiteId,
        });

        const buttonClicks = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        if (buttonData?.buttons) {
          buttonData.buttons.forEach((btn) => {
            if ([1, 2, 3, 4, 5].includes(btn.buttonId)) {
              buttonClicks[btn.buttonId] = btn.clicked;
            }
          });
        }

        const totalVisits = visit.userIpAddress.length;

        console.log(totalVisits, "added");
        const fifthButtonClicks = buttonClicks[5];

        const conversionPercentage =
          fifthButtonClicks > 0
            ? ((fifthButtonClicks / totalVisits) * 100).toFixed(2)
            : 0;

        // console.log(conversionPercentage, "converted");

        return {
          websiteId: visit.websiteId,
          totalVisits,
          conversionPercentage: `${conversionPercentage}%`,
          buttonClicks,
          websiteName: visit.websiteName,
          date: new Date().toLocaleDateString(),
        };
      })
    );

    res.status(200).send({
      success: true,
      data: websiteStats,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message || "Internal Server Error",
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


app.post("/api/user/session/start", async (req, res) => {
  try {
    const { websiteId, sessionId } = req.body;
    const clientIp = requestIp.getClientIp(req);

    if (!websiteId || !sessionId) {
      return res.status(400).send({ success: false, message: "websiteId and sessionId are required" });
    }

    await sessionModel.create({
      websiteId,
      sessionId,
      startTime: new Date(),
      clientIp,
      interactions: 0
    });

    res.status(200).send({ success: true, message: "Session started" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.post("/api/user/session/interaction", async (req, res) => {
  try {
    const { websiteId, sessionId } = req.body;

    await sessionModel.updateOne(
      { websiteId, sessionId },
      { $inc: { interactions: 1 } }
    );

    res.status(200).send({ success: true, message: "Interaction recorded" });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.post("/api/user/session/end", async (req, res) => {
  try {
    const { websiteId, sessionId } = req.body;

    const session = await sessionModel.findOne({ websiteId, sessionId });
    if (!session) {
      return res.status(404).send({ success: false, message: "Session not found" });
    }

    const endTime = new Date();
    const sessionDuration = (endTime - session.startTime) / 1000; // in seconds

    await sessionModel.updateOne(
      { websiteId, sessionId },
      { $set: { endTime, sessionDuration } }
    );

    res.status(200).send({ success: true, message: "Session ended", duration: sessionDuration });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});

app.get("/api/user/analytics/:websiteId", async (req, res) => {
  try {
    const { websiteId } = req.params;

    const sessions = await sessionModel.find({ websiteId });
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((acc, session) => acc + (session.sessionDuration || 0), 0);
    const bounces = sessions.filter(session => session.interactions === 0).length;

    const averageSessionDuration = totalSessions ? (totalDuration / totalSessions).toFixed(2) : 0;
    const bounceRate = totalSessions ? ((bounces / totalSessions) * 100).toFixed(2) : 0;

    res.status(200).send({
      success: true,
      analytics: {
        averageSessionDuration: `${averageSessionDuration} seconds`,
        bounceRate: `${bounceRate}%`
      }
    });
  } catch (error) {
    res.status(500).send({ success: false, message: error.message });
  }
});
