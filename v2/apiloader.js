import * as gapijs from 'https://apis.google.com/js/client.js';

const SCOPES = ["https://www.googleapis.com/auth/userinfo.email","https://www.googleapis.com/auth/drive.appfolder"];

var webRoot = 'https://localhost:8080/';
if(typeof window !== 'undefined'){
    webRoot = 'https://' + window.location.host + '/';
    if (window.location.hostname == 'localhost'
        || window.location.hostname == '127.0.0.1'
        || ((window.location.port != "") && (window.location.port > 1023))) {
          // We're probably running against the DevAppServer
          webRoot = 'http://' + window.location.host.replace("8081","8080") + '/';
    }
}
webRoot = self.joinServer;
const apiRoot =  webRoot + '_ah/api';

export class ApiLoader{
    constructor(clientId,scopes){
        this.clientId = clientId;
        if(!scopes){
            scopes = SCOPES;
        }
        this.scopes = scopes;
        this.apis = [];
    }
    getDiscoveryDoc(api){
        var discoveryDoc = api.setRoot  ? apiRoot + "/" : "https://www.googleapis.com/";
        discoveryDoc += `discovery/v1/apis/${api.name}/${api.version}/rest`;
        return discoveryDoc;
    }
    addApi(api){
        this.apis.push(api);
    }
    //call after the initial load
    async loadApi(api){
        if(!gapi.client) throw "Must call load first";

        const doc = this.getDiscoveryDoc(api);
        return gapi.client.load(doc);
    }
    async loadApis(apis){
        const all = apis.map(api=>this.loadApi(api));
        return Promise.all(all);
    }
    load(){
        const me = this;
        return new Promise(function(resolve,reject){
            const afterAuth2 = ()=>{
                var discoveryDocs = me.apis.map(api=>me.getDiscoveryDoc(api));
                return gapi.client.init({
                    discoveryDocs: discoveryDocs,
                    clientId: me.clientId,
                    scope: me.scopes.join(" ")
                }).then(()=>{
                    console.log("Done loading APIs!");
                    resolve();
                },e=>{
                    console.error(e);
                    reject(e);
                });
            };
            if(gapi.client && gapi.client.oauth2){
                afterAuth2();
            }else{
                gapi.load('client:auth2', afterAuth2);
            }

        });
    }
}