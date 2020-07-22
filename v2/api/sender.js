import '../extensions.js';
export class Sender {
	static get newMessageId(){
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		    return v.toString(16);
		});
	}
	static get newSuccessResult(){
		return new SendResult(Sender.newMessageId,true);
	}

	static get GCM_PARAM_TIME_TO_LIVE() {return "time_to_live"}
	static get GCM_PARAM_PRIORITY() {return "priority"}
	static get GCM_MESSAGE_PRIORITY_HIGH() {return "high"}
	static get GCM_PARAM_DELAY_WHILE_IDLE() {return "delay_while_idle"}
}
class SendResult {
	constructor(messageId,success,message){
		this.messageId = messageId;
		this.success = success;
		this.message = message;
	}
}
export class SendResults extends Array {
	static fromMany(many){
		var finalResult = new SendResults();
		if(!many || many.length == 0) return finalResult;
		for(var results of many){
			finalResult.merge(results);
		}
		return finalResult;
	}
	constructor(results){
		super();
		if(!results || results.length == 0) return;

		this.merge(results)
	}
	merge(other){
		for(var result of other){
			this.push(new SendResult(result.messageId,result.success,result.message));
		}
		this.success = this.count(result=>result.success);
		this.failure = this.count(result=>!result.success);
		this.id = Sender.newMessageId;
	}
}
export class SenderGCM extends Sender{
	//gcmRaw, devices, gcmParams
	async send(options){		
		var content = {
	        "data": await options.gcmRaw,
	        "registration_ids": options.devices.map(device=>device.regId2)
	    }
	    content = Object.assign(content, options.gcmParams)

	    content[Sender.GCM_PARAM_PRIORITY] = Sender.GCM_MESSAGE_PRIORITY_HIGH;
	    content[Sender.GCM_PARAM_DELAY_WHILE_IDLE] = false;
		var postOptions = {
			method: 'POST',
			body: JSON.stringify(content), 
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'key=AIzaSyDvDS_KGPYTBrCG7tppCyq9P3_iVju9UkA',
				'Content-Type': 'application/json; charset=UTF-8'
			}
		}
		var url = "https://fcm.googleapis.com/fcm/send";
		const result = await fetch(url, postOptions);
		if(result.status != 200){
			const textResult = await result.text();
			throw textResult;
		}

		const results = await result.json();

		const finalResults = results.results.map(result=>{
			if(result.message_id){
				return new SendResult(result.message_id,true);
			}else{
				return new SendResult(null,false);
			}
		});
		return new SendResults(finalResults);

	}
}
export class SenderIP extends Sender {
	async send(options){
		const body = JSON.stringify(await options.gcmRaw);
		const allPromises = options.devices.map(async device => {			
			var doForOneDevice = async options => {
				var regId = options.secondTry ? device.regId : device.regId2;
				var postOptions = {
					method: 'POST',
					body, 
					headers: {
						'Content-Type': 'application/json'
					}
				}
				var url = `http://${regId}/push`;
				try{
					const result = await fetch(url,postOptions);
					const textResult = await result.text();
					return Sender.newSuccessResult;
				}catch{
					if(options.secondTry) return {"success":false,"error": typeof error == "string" ? error : error.message};
					options.secondTry = true;
					return await doForOneDevice(options);
				}
			}
			return await doForOneDevice(options);
		})
		const allResults = Promise.all(allPromises)
		return new SendResults(allResults);
	}
}
export class SenderLocal extends Sender {
	async send(options){
		const body = JSON.stringify(await options.gcmRaw);
		const allPromises = options.devices.map(async device => {
			const postOptions = {
				method: 'POST',
				body, 
				headers: {
					'Content-Type': 'application/json'
				}
			}
			let token = null;
			if(self.getAuthTokenPromise){
				token = await self.getAuthTokenPromise();
			}
			if(!token && options.getToken){
				token = await options.getToken();
			}
			if(!token){
				token = (await import('../google/account/googleaccount.js')).GoogleAccount.getToken();
			}
			
			if(!token){
				return Promise.reject("User not signed in");
			}
			const address = options.overrideAddress || device.localNetworkServerAddress;
			const url = `${address}gcm?token=${token}`;
			const result = await fetch(url,postOptions)
			const jsonResult =  await result.json();
			return Sender.newSuccessResult;
		});
		const allResults = await Promise.all(allPromises);
		return new SendResults(allResults);
	}
}
export class SenderMyself extends Sender {
	async send(options){
		const gcmRaw = await options.gcmRaw;
		await GCMBase.executeGcmFromJson(gcmRaw.type,gcmRaw.json);
		return new SendResults([Sender.newSuccessResult]);
	}
}
export class SenderWebSocket extends Sender {
	async send(options){
		const body = JSON.stringify(await options.gcmRaw);
		const allPromises = options.devices.map(async device => {
			const socket = device.socket;
			if(!socket){				
				return Promise.reject("Device does not have an active socket");
			}
			await socket.send(body);
			return Sender.newSuccessResult;
		});
		const allResults = await Promise.all(allPromises);
		return new SendResults(allResults);
	}
}
export class SenderIFTTT extends Sender {
	send(options){
		var text = options.gcmPush.push.text;
		if(!text) return Promise.reject("Push to IFTTT needs text");

		return import('./autoapps.js').then(imported=>{
			const AutoAppsCommand = imported.AutoAppsCommand;
			
			return Promise.all(options.devices.map(device=>{			
				var autoAppsCommand = new AutoAppsCommand(text,"value1,value2,value3");
				var valuesForIfttt = {};
				var url = `https://maker.ifttt.com/trigger/${autoAppsCommand.command}/with/key/${device.regId}`;
				if(autoAppsCommand.values.length > 0){
					url += "?"
				}
				for (var i = 0; i < autoAppsCommand.values.length; i++) {
					var value = autoAppsCommand.values[i]
					var varName = `value${i+1}`;
					valuesForIfttt[varName] = value;
					if(i>0){
						url += "&";
					}
					url += `${varName}=${encodeURIComponent(value)}`;
				}
				//console.log(valuesForIfttt);
				var postOptions = {
					method: 'GET',
					//body: JSON.stringify(valuesForIfttt), 
					headers: {
						'Content-Type': 'application/json; charset=UTF-8'
					}
				}
				//console.log(url);
				return fetch(url,postOptions).then(result=>Sender.newSuccessResult).catch(error=>Sender.newSuccessResult).then(result => (new SendResults([result])));
			}));
		});		
	}
}
export class SenderServer extends Sender {
	async send(options){
		const ApiServer = (await import("../api/apiserver.js")).ApiServer;
		var result = null;
		var deviceIds = options.devices.map(device=>device.deviceId).join(",");
		if(options.gcmPush){
			options.gcmPush.push.deviceIds = deviceIds;
			result = await ApiServer.sendPush(options.gcmPush.push);
		}else{
			var rawGcmWithOptions = await options.gcmRaw;
			if(Util.isString(deviceIds)){
				deviceIds = deviceIds.split(",");
			}
			rawGcmWithOptions.deviceIds = deviceIds;
			result = await ApiServer.sendGenericPush(rawGcmWithOptions);
		}
		var sendResults = new SendResults();
		for(var device of options.devices){
			if(!result.success){
				sendResults.push(new SendResult(null,false,result.errorMessage));
			}else{
				sendResults.push(new SendResult(SendResult.newMessageId,true));
			}
		}
		return sendResults;
	}
}