const fetch = require('node-fetch');
const Store = require('./store.js');
const authStore = new Store({
    configName: 'auth',
    defaults: null
});
class AuthData{
    constructor(raw){
        if(raw == null) return;

        Object.assign(this,raw);
    }

    get isExpired(){
        if(!this.refresh_token) return true;
        if(!this.expires_on) return true;

        const now = new Date().getTime();
        const expired = now > this.expires_on;
        // console.log("Checking is expired time",now,this.expires_on,expired);
        return expired;
    }
}
class GoogleAuth{
    /**
     * 
     * @param {String} accessCode 
     * @returns {AuthData}
     */
    static async storeAuthData(accessCode){
        const options = {
            method:"POST",
            headers:{
                "Content-Type":"application/x-www-form-urlencoded"
            },
            body: `code=${encodeURIComponent(accessCode)}&client_id=596310809542-giumrib7hohfiftljqmj7eaio3kl21ek.apps.googleusercontent.com&client_secret=NTA9UbFpNhaIP74B_lpxGgvR&redirect_uri=${encodeURIComponent("http://127.0.0.1:9876")}&grant_type=authorization_code`
        }
        // console.log("Sending to google auth code", options);
        const result = await fetch("https://oauth2.googleapis.com/token",options);
        const authDataRaw = await result.json();
        // console.log("Result from google auth code", authDataRaw);
        console.log("Stored Auth Data");
        GoogleAuth.authData = authDataRaw;
        return GoogleAuth.authData;
    }
    static get accessToken(){
        // console.log("Getting access token");
        
        const authData = GoogleAuth.authData;
        if(!authData.isExpired) return authData.access_token;
        
        console.log("Access token expired. Getting new one");
        const refresh_token = authData.refresh_token;
        if(!refresh_token) return null;
        
        return (async ()=>{
            const options = {
                method:"POST",
                headers:{
                    "Content-Type":"application/x-www-form-urlencoded"
                },
                body: `refresh_token=${encodeURIComponent(refresh_token)}&client_id=596310809542-giumrib7hohfiftljqmj7eaio3kl21ek.apps.googleusercontent.com&client_secret=NTA9UbFpNhaIP74B_lpxGgvR&grant_type=refresh_token`
            }
            // console.log("Sending to google auth refresh", options);
            const result = await fetch("https://oauth2.googleapis.com/token",options);
            const refreshResultObject = await result.json();
            Object.assign(authData,refreshResultObject);
            console.log("Result from google auth refresh", authData);
            GoogleAuth.authData = authData;
            return authData.access_token;
        })();
    }
    static get authData(){
        const raw = authStore.getData();
        return new AuthData(raw);
    }
    static set authData(value){
        const expires_in = value.expires_in;
        if(!expires_in) return;

        const now = new Date().getTime();

        value.expires_on = now + ((expires_in- 300)*1000) 
        authStore.setData(value);
    }
}
exports.GoogleAuth = GoogleAuth;