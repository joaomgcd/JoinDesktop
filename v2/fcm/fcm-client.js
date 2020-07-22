class FCMClientImplementation extends FCMClient{
	constructor(){
		const firebaseConfig = {
			apiKey: "AIzaSyBeI64VSoGCs20sXOwRG_kuDirugdScDIk",
			authDomain: "join-external-gcm.firebaseapp.com",
			databaseURL: "https://join-external-gcm.firebaseio.com",
			projectId: "join-external-gcm",
			storageBucket: "join-external-gcm.appspot.com",
			messagingSenderId: "737484412860",
			appId: "1:737484412860:web:5ddce9f690528241167db9"
		  }
		super([firebaseConfig])
		this.firebaseConfig = firebaseConfig;
	}
	async handleBackgroundMessage(serviceWorker, payload){
		var {notifications,gcm} = await this.handleMessage(payload);
		if(!gcm){
			gcm = {type:"GCMBase",json:"{}"};
		}
		if(!notifications){
			notifications = [];
		}
		for(const notification of notifications){
			if(notification.silent) return;
	
			const title = notification.title ? notification.title : "Join";
			const text = notification.text ? notification.text : `Done something in the background (${gcm.type.replace("GCM","")})`;
			const tag = notification.id ? notification.id : (notification.tag || "unknown");
			var options = {
				"tag":tag,
				"body":text,
				"data":{}
			}
			Object.assign(options,notification);
			if(!options.badge){
				options.badge = "/images/join_notification.png"
			}
			options.data.type = gcm.type;
			options.data.json = gcm.json;
			serviceWorker.registration.showNotification(title,options);
			const dbNotifications = DB.get().notifications;
			await dbNotifications.put({key:options.tag,json:JSON.stringify(options)});
			// setTimeout(()=>serviceWorker.registration.showNotification(title,options),100);
		}
	}
	async onNotificationClick(serviceWorker, event){
		const notification = event.notification;
		const action = event.action;
		console.log("Notification action",action);
		const data = notification.data;
		let {type,json} = notification.data;
		if(!json){
			json = JSON.stringify(notification.data);
		}
		return await GCMBase.handleClickGcmFromJson(serviceWorker, type,json,action,data);
	}
	async handleMessage(message){
		var multiIndexString = message.data.multi;
		var type = message.data.type;
		if(!multiIndexString){
			return await GCMBase.executeGcmFromJson(message.data.type,message.data.json);
		}else{
			var multiIndex = Number(multiIndexString);
			var length = Number(message.data.length);
			console.log("Got multi message index: " + multiIndex+"/"+length);
			var id = message.data.id;
			var value = message.data.value;
			var gcmMultis = gcmMultiMap.add(id,multiIndex,value,type,length);
			var complete = gcmMultis.getComplete();
			if(complete){
				console.log("GCM complete! Executing of type " + type);
				delete gcmMultiMap[id];
				return await GCMBase.executeGcmFromJson(complete.type,complete.json);
			}else{
				return {}
			}
		}
	}
	async getToken(){
		if(this.token) return this.token;

		return await super.getToken(this.firebaseConfig);
	}
	initPage(tokenCallback,messageCallback){
		const newTokenCallback = token => {
			this.token = token;
			tokenCallback(token);
		}
		super.initPage(newTokenCallback,messageCallback);
	}
}