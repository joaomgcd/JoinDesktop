import { EventBus } from "../../eventbus.js";

export class GoogleAccount {
	constructor({ clientId, scopes = ["email"] }) {
		this.clientId = clientId;
		this.scopesString = scopes.join(" ");	
	}
	initAuth2(){
		try{
			return gapi.auth2.init({
				client_id: this.clientId,
				cookiepolicy: 'single_host_origin',
				scope: this.scopesString
			});
		}catch{
			return gapi.auth2.getAuthInstance();
		}
	}
	loadAuth2(){
		return new Promise((resolve, reject) => {
			gapi.load('auth2', resolve);
		});
	} 
	loadClientAuth2(){
		return new Promise((resolve, reject) => {
			gapi.load('client:auth2', resolve);
		});
	}
	initGapi(options){
		return new Promise((resolve, reject) => {
			gapi.client.init(options).then(() => resolve());
		});
	}
	apiToDiscoveryDoc(api){
		var discoveryDoc = api.setRoot ? apiRoot + "/" : "https://www.googleapis.com/";
		discoveryDoc += `discovery/v1/apis/${api.name}/${api.version}/rest`;
		return discoveryDoc;
	}
	//Only call if gapi wasn't loaded before
	async load() {
		if(gapi.client && gapi.client.oauth2) return gapi;

		const apis = [{ "name": 'oauth2', "version": 'v2' }];
		var options = {
			discoveryDocs: apis.map(api => this.apiToDiscoveryDoc(api)),
			clientId: this.clientId,
			scope: this.scopesString
		};
		await this.loadAuth2();
		//await this.loadClientAuth2();
		await this.initGapi(options);
		await this.initAuth2();
		await this.getCurrentUser();
		return gapi;
	};
	getCurrentUser(){
		const result = { isSignedIn: false };
		const googleAuth = this.initAuth2();
		if (!googleAuth) return result;

		const userFromGapi = googleAuth.currentUser.get();
		if (!userFromGapi) return result;

		const profile = userFromGapi.getBasicProfile();
		if (!profile) return result;

		result.name = profile.getName();
		result.imageUrl = profile.getImageUrl();
		result.email = profile.getEmail();
		result.isSignedIn = googleAuth.isSignedIn.get();
		result.token = userFromGapi.getAuthResponse().access_token;
		if(this.lastEmail != result.email){
			EventBus.postSticky(new CurrentGoogleUserChanged(result));
		}
		this.lastEmail = result.email;
		return result;
	};
	static getCurrentUser(){
		const last = EventBus.get().getSticky(CurrentGoogleUserChanged);
		if(last == null) return null;

		return last.googleUser;
	}
	static getToken(){
		const last = GoogleAccount.getCurrentUser();
		if(last == null) return;

		return last.token;
	}
	get isSignedIn(){
		const user = this.getCurrentUser();
		return user.isSignedIn;
	}
	signOut(){
		return new Promise((resolve, reject) => {
			const auth2 = gapi.auth2.getAuthInstance();
			auth2.signOut().then(resolve);
			location.reload();
		});
	}
	attachSignInClickHandler({element, onSuccess, onFailure}){
		var options = {
			"prompt": "select_account",
			"ux_mode": "redirect"
		};
		gapi.auth2.getAuthInstance().attachClickHandler(element, options, onSuccess, onFailure);
	};
}

export class CurrentGoogleUserChanged{
	constructor(googleUser){
		this.googleUser = googleUser;
	}
}