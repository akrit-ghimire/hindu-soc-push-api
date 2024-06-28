const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require('firebase-admin/app');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");
const webpush = require("web-push")

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
    .catch(error => { resolve(false) })
})

exports.remind = onRequest(async (request, response) => {
    const subscribers = await getAll()
    subscribers.forEach(async subscriber => {
        const success = await sendNotification('remind', subscriber.webpush_details)
        if (!success) logger.log('Failed to send Reminder')
    })
    response.send("Reminders Sent");
});

exports.upcoming = onRequest(async (request, response) => {
    const subscribers = await getAll()
    subscribers.forEach(async subscriber => {
        const success = await sendNotification(subscriber.webpush_details, 'new')
        if (!success) logger.log('Failed to send Reminder')
    })
    response.send("Reminders Sent");
});

exports.subscribe = onRequest(async (request, response) => {
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

exports.helloworld = onRequest(async (request, response) => {
    try {
        response.send(`Hello World! Current Subscribers: ${(await getAll()).length}`);
    } catch (e) { 
        response.send("Failed to get Subscriber Count")
    }
});
