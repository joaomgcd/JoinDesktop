const promiseTimeout = function(ms, promise){

	// Create a promise that rejects in <ms> milliseconds
	let timeout = new Promise((resolve, reject) => {
	  let id = setTimeout(() => {
		clearTimeout(id);
		reject('Timed out in '+ ms + 'ms.')
	  }, ms)
	})
  
	// Returns a race between our timeout and the passed in promise
	return Promise.race([
	  promise,
	  timeout
	])
  }
class FCM {
	constructor(){
		//this.messageHandler = new MessageHandler();
		this.broadcastChannel = new BroadcastChannelFCM();
		this.isInServiceWorker = navigator.serviceWorker ? false : true;
		if(!FCM.firebaseApp){
			FCM.firebaseApp = {};
		}
	}
	async requestPermissions(){
		if(this.isInServiceWorker) return true;
		
		if(!Notification.requestPermission) return true;

		const result = await Notification.requestPermission()
		if (result === 'denied' || result === 'default') return false

		return true;
	}
	getFirebaseMessaging(firebaseConfig){
		const senderId = firebaseConfig.messagingSenderId
		var existingApp = FCM.firebaseApp[senderId];
		const alreadyInited =  existingApp ? true : false;
		if(!alreadyInited){
			existingApp = firebase.initializeApp(firebaseConfig,senderId)
			existingApp.messaging().usePublicVapidKey("BL7X8ZCBR05TrKnPcbWfix8ZNqHtfpbYF6f37ThsLKJsUc-l06KVn4QkkCOwzRKDQMb2gm9LPv-UD4gkcvhBUlQ");
			FCM.firebaseApp[senderId] = existingApp;				
		}
		const messaging = existingApp.messaging();
		return messaging;
	}
	async register(firebaseConfig){
		const wakeWorkerToRegisterSenderId = firebaseConfig =>{
			this.broadcastChannel.requestToken(firebaseConfig);
			if(navigator.serviceWorker.controller){
				navigator.serviceWorker.controller.postMessage(firebaseConfig);
				return true;			
			}
			return false;
		};
		const hasPermissions = await this.requestPermissions();
		if(!hasPermissions) return null;

		const messaging = this.getFirebaseMessaging(firebaseConfig);
		const isInServiceWorker = this.isInServiceWorker;
		
		const handleMessage = async payload => {
			if(!this.messageHandler) return;

			this.messageHandler.handle(payload);			
		};
		if(!isInServiceWorker){
			messaging.onMessage(handleMessage);
			this.broadcastChannel.onMessageReported(handleMessage);
		}
		if(isInServiceWorker){
			messaging.setBackgroundMessageHandler(handleMessage);
		}		
		if(!isInServiceWorker){
			const existingWorkers = await navigator.serviceWorker.getRegistrations();
			const existingWorkerCount = existingWorkers.length;
			var existingWorker = null;
			if(existingWorkerCount == 0){
				console.log("Registering FCM worker");
				existingWorker = await navigator.serviceWorker.register(`/firebase-messaging-sw.js`);
				messaging.useServiceWorker(existingWorker);	
			}else{
				existingWorker = existingWorkers[0];
			}
			await existingWorker.update();
			this.broadcastChannel.onWorkerRunning(()=>{
				wakeWorkerToRegisterSenderId(firebaseConfig);
			});
		}
		if(isInServiceWorker){
			return await messaging.getToken();
		}else{
			const result = new Promise((resolve,reject) => {
				this.broadcastChannel.onTokenReported(payload=>{
					const senderId = payload.firebaseConfig.messagingSenderId;
					if(senderId != firebaseConfig.messagingSenderId) return;

					resolve(payload.token);
				})
				const canWakeUp = wakeWorkerToRegisterSenderId(firebaseConfig);
			});
			try{
				return await promiseTimeout(3000,result);			
			}catch(error){
				console.error(`Timed out waiting for service worker token`,error);
				return null;
			}

		}
	}
	onMessage(firebaseConfig, callback){
		if(this.isInServiceWorker){
			this.getFirebaseMessaging(firebaseConfig).setBackgroundMessageHandler(callback);
		}
		this.messageHandler = {"handle":callback}

	}
}

const CACHE_NAME = 'static-cache-v1';
const FILES_TO_CACHE = [
	'/offline.html',
	'/manifest.json',
	'/favicon.ico',
	'/images/join.png',
  ];
class FCMClient{
	constructor(firebaseConfigs){
		this.firebaseConfigs = firebaseConfigs;
		this.fcm = new FCM();
	}
	async registerServiceWorker(firebaseConfig, count,error){
		if(count>=3){
			console.error(`Giving up registration!! (${error.message})`,error);
			return null;
		}
		if(count > 0){
			console.log(`Retrying register ${count}...`)
		}
		try{
			const token = await this.fcm.register(firebaseConfig);		
			return token;
		}catch(error){
			if(!count){
				count = 0;
			}
			return this.registerServiceWorker(firebaseConfig,++count,error);
		}
	}
	async getTokenAndReport(firebaseConfig){
	    console.log("SW registering and Reporting", firebaseConfig);
		const token = await this.registerServiceWorker(firebaseConfig);
		this.fcm.broadcastChannel.reportToken(firebaseConfig,token);
		return token;
	}
	initServiceWorker(serviceWorker, messageCallback){
	//	try{
	//		await clients.claim();
			serviceWorker.addEventListener('install', function (event) {

				self.skipWaiting();

				const func = async ()=>{			
					console.log('[ServiceWorker] New Version! Pre-caching offline page');
					const cache = await caches.open(CACHE_NAME);
					return await cache.addAll(FILES_TO_CACHE);
				}
				event.waitUntil(func());
			});
			serviceWorker.addEventListener('activate', function (event) {
				console.log('[ServiceWorker] Activate');
				const func = async ()=>{	
					const keyList = await caches.keys();		
					for(const key of keyList){
						if (key === CACHE_NAME) continue;
						
						console.log('[ServiceWorker] Removing old cache', key);
						await caches.delete(key);
					}
				};
				event.waitUntil(func());
			});
			// serviceWorker.addEventListener('fetch', function (event) {
			// 	console.log('[ServiceWorker] Fetch', event.request.url);
			// 	const responseFunc = async () => {
			// 		try{
			// 			return await fetch(event.request)
			// 		}catch(error){
			// 			if(event.request.url.indexOf(":")>0) throw error;
						
			// 			console.log('[ServiceWorker] Fetch error', error);
			// 			const cache = await caches.open(CACHE_NAME);
			// 			for(const page of FILES_TO_CACHE){
			// 				if(event.request.url.endsWith(page)){
			// 					return cache.match(page);
			// 				}
			// 			}
			// 			throw error;
			// 			// return cache.match('offline.html');
			// 		}
			// 	};
			// 	event.respondWith(responseFunc());
			// });
			this.fcm.broadcastChannel.onTokenRequested(async firebaseConfig=>{
				await this.getTokenAndReport(firebaseConfig);
			});
			this.fcm.broadcastChannel.onRequestShowNotification(async notification => {
				var title = notification.title;
				if(!title){
					title = "Join";
				}
				if(!notification.body && notification.text){
					notification.body = notification.text;
				}
				setTimeout(()=>serviceWorker.registration.showNotification(title,notification),100);
			});
			this.fcm.broadcastChannel.onRequestCheckConnectedClients(async ({myDeviceId,authToken})=>{
				await Util.sleep(1000);
				const clients = await self.clients.matchAll({includeUncontrolled:true,type:"window"});
				if(clients && clients.length > 0) return;
				
				const gcmNotOnLocalNetwork = new GCMDeviceNotOnLocalNetwork();
				gcmNotOnLocalNetwork.authToken = authToken;
				gcmNotOnLocalNetwork.senderId = myDeviceId;
				const gcmRaw = await gcmNotOnLocalNetwork.gcmRaw;				
				gcmRaw.deviceIds = (await DB.get().devices.toArray()).map(device=>device.deviceId).filter(deviceId=>deviceId != myDeviceId);
				const result = await gcmNotOnLocalNetwork.sendRawGcm(gcmRaw);
				console.log("Service Worker Clients",clients,result);
			});
			for(var firebaseConfig of this.firebaseConfigs){	
				this.fcm.onMessage(firebaseConfig, async payload=>{
					this.handleBackgroundMessage(serviceWorker, payload);
					this.fcm.broadcastChannel.reportMessage(payload);
				});
			}
			serviceWorker.addEventListener('message', async event => {
				const senderId = event.data;
				await this.getTokenAndReport(senderId);
			});
			self.addEventListener('notificationclick',event=> {
				if(!this["onNotificationClick"]) return;

				const promise = this.onNotificationClick(serviceWorker,event);
				//const func = async () =>console.log("Opening url",await clients.openWindow("https://www.reddit.com/r/tasker/"));
				event.waitUntil(promise);
			});
			this.fcm.broadcastChannel.reportWorkerRunning();
	/*	}catch(error){
			console.error(error);
		}*/
	}
	initPage(tokenCallback,messageCallback){
		for(var firebaseConfig of this.firebaseConfigs){
			this.fcm.register(firebaseConfig).then(token=> {
				tokenCallback(token);
			});			
			this.fcm.onMessage(firebaseConfig, payload=>{
				messageCallback(payload);
			});	
		}
	}	
	async onMessage(callback){
		this.firebaseConfigs.forEach(firebaseConfig=>this.fcm.onMessage(firebaseConfig, callback));
	}
	async getTokens(){
		const result = [];
		for(const firebaseConfig of this.firebaseConfigs){
			const token = await this.fcm.register(firebaseConfig);
			result.push({token,firebaseConfig});
		}
		return result;
	}
	async getToken(firebaseConfig){
		return await this.fcm.register(firebaseConfig);
	}
	async showNotification(notification,gcm){
		if(!notification.data){
			notification.data = {};
		}
		Object.assign(notification.data,await gcm.gcmRaw);
		return await this.fcm.broadcastChannel.requestShowNotification(notification);
	}
	async reportWindowUnloaded(args = {myDeviceId,authToken}){
		return await this.fcm.broadcastChannel.requestCheckConnectedClients(args);
	}
}
/*class BroadcastChannelFCM{
	constructor(){

		this.isInServiceWorker = navigator.serviceWorker ? false : true;
		BroadcastChannelFCM.ACTION_REQUEST_TOKEN = 'request-token';
		BroadcastChannelFCM.ACTION_REPORT_TOKEN = 'report-token';

		BroadcastChannelFCM.ACTION_REPORT_MESSAGE = 'report-message';

		BroadcastChannelFCM.ACTION_WORKER_RUNNING = 'worker-running';

		BroadcastChannelFCM.EXTRA_SENDER_ID = 'sender-id';
		BroadcastChannelFCM.EXTRA_TOKEN = 'token';
		BroadcastChannelFCM.EXTRA_MESSAGE = 'message';

		if(!this.isInServiceWorker){
			 navigator.serviceWorker.addEventListener('message', event => {
		        const data = event.data;
				if(!data) return;

		        console.log("Page Received Broadcast: " + data);
	            if(data[BroadcastChannelFCM.ACTION_REPORT_TOKEN]){
					this.doCallback(this.tokenReportedCallback, {"senderId":data[BroadcastChannelFCM.EXTRA_SENDER_ID],"token":data[BroadcastChannelFCM.EXTRA_TOKEN]},port);
				}else if(data[BroadcastChannelFCM.ACTION_WORKER_RUNNING]){
					this.doCallback(this.workerRunningCallback,port);
				}
	        });
		}else{
			self.addEventListener('message', event => {

		        const data = event.data;
				if(!data) return;

		        console.log("Service Worker Received Broadcast: " + data);
		        const port = event.ports[0];

				if(data[BroadcastChannelFCM.ACTION_REQUEST_TOKEN]){
					this.doCallback(this.tokenRequestedCallback, data[BroadcastChannelFCM.EXTRA_SENDER_ID],port);
				}
		    });				
		}
	}

	doCallback(callback,payload,port){
		if(!callback) return;

		callback(payload,port);
	}
	postFcmMessage(messageChanger,port){
		const message = {};
		messageChanger(message);
		if(this.isInServiceWorker){
			self.clients.forEach(client=>{ 
				client.postMessage(message)
			});
		}else{
			const sender = navigator.serviceWorker.controller;
			if(!sender) return;
			sender.postMessage(message);
		}
	}


	requestToken(senderId){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REQUEST_TOKEN] = true;
			message[BroadcastChannelFCM.EXTRA_SENDER_ID] = senderId;
		});
	}
	onTokenRequested(callback){
		this.tokenRequestedCallback = callback;
	}


	reportToken(senderId,token){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REPORT_TOKEN] = true;
			message[BroadcastChannelFCM.EXTRA_SENDER_ID] = senderId;
			message[BroadcastChannelFCM.EXTRA_TOKEN] = token;
		});
	}
	onTokenReported(callback){
		this.tokenReportedCallback = callback;
	}


	reportMessage(fcmMessage){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REPORT_MESSAGE] = true;
			message[BroadcastChannelFCM.EXTRA_MESSAGE] = fcmMessage;
		});
	}
	onMessageReported(callback){
		this.messageReportedCallback = callback;
	}

	reportWorkerRunning(){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_WORKER_RUNNING] = true;
		});
	}
	onWorkerRunning(callback){
		this.workerRunningCallback = callback;
	}
}*/
let parent = Object;
if(self["BroadcastChannel"]){
	parent = BroadcastChannel;
}
class BroadcastChannelFCM extends parent{
	constructor(){
		super("BroadcastChannelFCM");
		if(!this["postMessage"]){
			this.postMessage = message => {console.log("Can't post. Broadcast Channel not implemented",message)}
		}
		BroadcastChannelFCM.ACTION_REQUEST_TOKEN = 'request-token';
		BroadcastChannelFCM.ACTION_REPORT_TOKEN = 'report-token';

		BroadcastChannelFCM.ACTION_REPORT_MESSAGE = 'report-message';

		BroadcastChannelFCM.ACTION_WORKER_RUNNING = 'worker-running';

		BroadcastChannelFCM.ACTION_REQUEST_SHOW_NOTIFICATION = 'request-show-notification';
		BroadcastChannelFCM.ACTION_CHECK_CONNECTED_CLIENTS = 'check-connected-clients';

		BroadcastChannelFCM.EXTRA_SENDER_ID = 'sender-id';
		BroadcastChannelFCM.EXTRA_TOKEN = 'token';
		BroadcastChannelFCM.EXTRA_MESSAGE = 'message';
		BroadcastChannelFCM.EXTRA_NOTIFICATION = 'notification';

		this.addEventListener('message',async event => {
			const data = event.data;
			if(!data) return;

			if(data[BroadcastChannelFCM.ACTION_REQUEST_TOKEN]){
				this.doCallback(this.tokenRequestedCallback, data[BroadcastChannelFCM.EXTRA_SENDER_ID]);
			}else if(data[BroadcastChannelFCM.ACTION_REPORT_TOKEN]){
				this.doCallback(this.tokenReportedCallback, {"firebaseConfig":data[BroadcastChannelFCM.EXTRA_SENDER_ID],"token":data[BroadcastChannelFCM.EXTRA_TOKEN]});
			}else if(data[BroadcastChannelFCM.ACTION_REPORT_MESSAGE]){
				this.doCallback(this.messageReportedCallback, data[BroadcastChannelFCM.EXTRA_MESSAGE]);
			}else if(data[BroadcastChannelFCM.ACTION_WORKER_RUNNING]){
				this.doCallback(this.workerRunningCallback);
			}else if(data[BroadcastChannelFCM.ACTION_REQUEST_SHOW_NOTIFICATION]){
				this.doCallback(this.showNotificationCallback, data[BroadcastChannelFCM.EXTRA_NOTIFICATION]);
			}else if(data[BroadcastChannelFCM.ACTION_CHECK_CONNECTED_CLIENTS]){
				this.doCallback(this.checkConnectedClientsCallback, data[BroadcastChannelFCM.EXTRA_MESSAGE]);
			}
		});
	}

	doCallback(callback,payload){
		if(!callback) return;

		callback(payload);
	}
	postFcmMessage(messageChanger){
		const message = {};
		messageChanger(message);
		this.postMessage(message);
	}


	requestToken(firebaseConfig){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REQUEST_TOKEN] = true;
			message[BroadcastChannelFCM.EXTRA_SENDER_ID] = firebaseConfig;
		});
	}
	onTokenRequested(callback){
		this.tokenRequestedCallback = callback;
	}


	reportToken(firebaseConfig,token){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REPORT_TOKEN] = true;
			message[BroadcastChannelFCM.EXTRA_SENDER_ID] = firebaseConfig;
			message[BroadcastChannelFCM.EXTRA_TOKEN] = token;
		});
	}
	onTokenReported(callback){
		this.tokenReportedCallback = callback;
	}


	reportMessage(fcmMessage){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REPORT_MESSAGE] = true;
			message[BroadcastChannelFCM.EXTRA_MESSAGE] = fcmMessage;
		});
	}
	onMessageReported(callback){
		this.messageReportedCallback = callback;
	}

	reportWorkerRunning(){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_WORKER_RUNNING] = true;
		});
	}
	onWorkerRunning(callback){
		this.workerRunningCallback = callback;
	}

	requestShowNotification(notification){
		notification = JSON.stringify(notification);
		notification = JSON.parse(notification);
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_REQUEST_SHOW_NOTIFICATION] = true;
			message[BroadcastChannelFCM.EXTRA_NOTIFICATION] = notification;
		});
	}
	onRequestShowNotification(callback){
		this.showNotificationCallback = callback;
	}

	requestCheckConnectedClients(args){
		this.postFcmMessage(message=>{
			message[BroadcastChannelFCM.ACTION_CHECK_CONNECTED_CLIENTS] = true;
			message[BroadcastChannelFCM.EXTRA_MESSAGE] = args;
		});
	}
	onRequestCheckConnectedClients(callback){
		this.checkConnectedClientsCallback = callback;
	}
}