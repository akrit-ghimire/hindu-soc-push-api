const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler")
const { initializeApp } = require('firebase-admin/app');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");
const webpush = require("web-push")
require('dotenv').config()

const PASSKEY = process.env.PASSKEY

initializeApp();

const getAll = async () => {
    try {
        const snapshot = await admin.firestore().collection('subscribers').get();
        const allDocuments = [];
        snapshot.forEach(doc => { allDocuments.push(doc.data()); });
        return allDocuments
    }
    catch { return [] }
}
const setDoc = async (webpush_details = "null") => {
    docRef = admin.firestore().collection('subscribers').doc()
    try {
        await docRef.set({ webpush_details });
        return true
    } catch (error) {
        logger.error("Error writing data", error);
        return false
    }
}

const sendNotification = async (type, subscriber) => new Promise((resolve, reject) => {
    const public = "BPq3FGcZuuoNOSmf_dI3kp6eIdIeTS-r2AEtteP1ImCQrM5ZkybsSs1FUzfijPhCroWjm2v0FEt9omfPhmCJ83k"
    const private = "LWA34gMwEXj40XHdRkXaqylFaltHFFYc5meBy2YRCnE"

    webpush.setVapidDetails(
        'mailto:edinburghhindusociety@gmail.com',
        public,
        private
    )
    webpush.sendNotification(subscriber, type)
        .then(() => { resolve(true) })
        .catch(error => { logger.log(error); resolve(false) })
})

exports.emergency = onRequest(async (request, response) => {
    const allowedOrigins = ['https://edinburgh-hindu-society.firebaseapp.com']; // Replace with your domain
    const origin = request.headers.origin;

    if (allowedOrigins.includes(origin)) {
        response.set('Access-Control-Allow-Origin', origin);
        response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.set('Access-Control-Allow-Headers', 'Content-Type');
        response.set('Access-Control-Allow-Credentials', 'true');
    } else {
        response.set('Access-Control-Allow-Origin', 'https://edinburgh-hindu-society.firebaseapp.com');
    }

    if (request.method === 'OPTIONS') {
        // Preflight request
        response.status(204).send('');
        return;
    }

    const queryParams = request.query
    const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress || request.headers['fastly-client-ip']
    const title = queryParams.title || ''
    const message = queryParams.message || ''
    const passkey = queryParams.passkey || ''

    if (title.length < 3 || message.length < 3 || passkey.length !== 12 || passkey !== PASSKEY) {
        response.send("INVALID");
        return
    }

    const subscribers = await getAll()
    subscribers.forEach(async subscriber => {
        const success = await sendNotification(JSON.stringify({
            title, message, header: 'EMERGENCY'
        }), subscriber.webpush_details)
        if (!success) logger.log('Failed to send Emergency Message')
    })

    logger.log(`IP: ${ip} sent Emergency Message: ${title} - ${message}`)
    response.send("SUCCESS");
})

exports.remind = onSchedule('every day 09:00', async (event) => {
    logger.log('Sending Reminder Notifications Now!');
    const subscribers = await getAll()
    subscribers.forEach(async subscriber => {
        const success = await sendNotification('remind', subscriber.webpush_details)
        if (!success) logger.log('Failed to send Reminder')
    })
})

exports.upcoming = onSchedule('every monday,friday 14:00', async (event) => {
    logger.log('Sending Upcoming Notifications Now!');
    const subscribers = await getAll()
    subscribers.forEach(async subscriber => {
        const success = await sendNotification('new', subscriber.webpush_details)
        if (!success) logger.log('Failed to send Notification')
    })
})

exports.subscribe = onRequest(async (request, response) => {
    const allowedOrigins = ['https://edinburgh-hindu-society.firebaseapp.com']; // Replace with your domain
    const origin = request.headers.origin;

    if (allowedOrigins.includes(origin)) {
        response.set('Access-Control-Allow-Origin', origin);
        response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.set('Access-Control-Allow-Headers', 'Content-Type');
        response.set('Access-Control-Allow-Credentials', 'true');
    } else {
        response.set('Access-Control-Allow-Origin', 'https://edinburgh-hindu-society.firebaseapp.com');
    }

    if (request.method === 'OPTIONS') {
        // Preflight request
        response.status(204).send('');
        return;
    }

    const webpush_details = request.body
    const subscribers = await getAll()

    for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i]
        if (subscriber.webpush_details.endpoint !== webpush_details.endpoint) continue

        response.send("Already Subbed");
        return
    }

    const success = await setDoc(webpush_details)
    if (success) response.send("Subscribed");
    else response.send("Failed to Subscribe");
});