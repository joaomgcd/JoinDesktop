let serviceWorker = self;
serviceWorker.addEventListener('install', function (event) {

    self.skipWaiting();

    const message = '[ServiceWorker] New Version!!';
    console.log(message);
    let notification ={
        body:message
    }
    serviceWorker.registration.showNotification("Service Worker",notification)
});
serviceWorker.addEventListener('activate',event=>{
    
    self.skipWaiting();

    const message = '[ServiceWorker] Activated!!!';
    console.log(message);
    let notification ={
        body:message
    }
    event.waitUntil(serviceWorker.registration.showNotification("Service Worker",notification))
})