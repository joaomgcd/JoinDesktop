const USE_LOCAL_SERVER = false;
const JOIN_SERVER_LOCAL = "http://localhost:8080";
// const JOIN_SERVER = "https://joinjoaomgcd.appspot.com";
const JOIN_SERVER = self.joinServer;
const JOIN_BASE_URL = `${USE_LOCAL_SERVER ? JOIN_SERVER_LOCAL : JOIN_SERVER}/_ah/api/`;
const get = async (url,parameters) => {
    const token = await self.getAuthTokenPromise();
    if(parameters){
        let urlParams = ""
        for(const parameterName in parameters){
            if(!urlParams){
                urlParams = "?";
            }else{
                urlParams += "&";
            }
            const parameterValue = encodeURIComponent(parameters[parameterName]);
            urlParams += `${parameterName}=${parameterValue}`
        }
        url = url + urlParams;
    }
    const result = await UtilWeb.get({url,token});
    return result;
}
const post = async (url,contentObject) => {
    const token = await self.getAuthTokenPromise();
    const result = await UtilWeb.post({url,contentObject,token});
    return result;
}
const del = async (url) => {
    const token = await self.getAuthTokenPromise();
    const result = await UtilWeb.delete({url,token});
    return result;
}
const postMessaging = async (endpoint,contentObject) => await post(`${JOIN_BASE_URL}messaging/v1/${endpoint}`,contentObject)
const getRegistration = async (endpoint,parameters) => await get(`${JOIN_BASE_URL}registration/v1/${endpoint}`,parameters)
const postRegistration = async (endpoint,contentObject) => await post(`${JOIN_BASE_URL}registration/v1/${endpoint}`,contentObject)
const getAutorization = async (endpoint,parameters) => await get(`${JOIN_BASE_URL}authorization/v1/${endpoint}`,parameters)
const deleteAutorization = async (endpoint,parameters) => await del(`${JOIN_BASE_URL}authorization/v1/${endpoint}`,parameters)
export class ApiServer{
    static async getDevices(){
        const result = await getRegistration("listDevices");
        return result.records;
        // const result = await gapi.client.registration.listDevices();
        // const devicesRaw = result.result.records;
        // return devicesRaw;
    }
    static async sendPush(push){
        return await postMessaging(`sendPush`,push);
        // const result = await gapi.client.messaging.sendPush(push);
		// console.log(result);
        // return result.result;
    }
    static async registerBrowser({deviceId,deviceName,token}){
        const contentObject = {"deviceId":deviceId,"regId":token,"regId2":token,"deviceName":deviceName,"deviceType":6};
        return await postRegistration("registerDevice",contentObject);
        // const resultApi = await gapi.client.registration.register(contentObject);
        // const result = resultApi.result;
        // return result;
    }
    static async unregisterDevice({deviceId}){
        return await postRegistration("unregisterDevice",{deviceId});
        // const resultApi = await gapi.client.registration.unregisterDevice({deviceId});
        // const result = resultApi.result;
        // return result;
    }
    static async renameDevice({deviceId,deviceName}){
        const contentObject = {"deviceId":deviceId,"newName":deviceName};
        return await postRegistration("renameDevice",contentObject);
        // const resultApi = await gapi.client.registration.renameDevice(contentObject);
        // const result = resultApi.result;
        // return result;
    }
    static async sendGenericPush(genericPush){
        return await postMessaging(`sendGenericPush`,genericPush);
        // const resultApi = await gapi.client.messaging.sendGenericPush(genericPush);
        // const result = resultApi.result;
        // return result;
    }
    static async getApiKey(){
        const parameters = {"reset":false};
        return (await getAutorization("apikey",parameters)).apikey;
        // const resultApi = await gapi.client.authorization.getApiKey(parameters);
        // const result = resultApi.result.apikey;
        // return result;
    }
    static async resetApiKey(){
        const parameters = {"reset":true};
        return (await getAutorization("apikey",parameters)).apikey;
        // const resultApi = await gapi.client.authorization.getApiKey(parameters);
        // const result = resultApi.result.apikey;
        // return result;
    }
    static async deleteApiKey(){
        return (await deleteAutorization("apikey")).apikey;
        // const resultApi = await gapi.client.authorization.deleteApiKey();
        // const result = resultApi.result.apikey;
        // return result;
    }
}