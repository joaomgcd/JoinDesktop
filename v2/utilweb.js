class UtilWeb{
    static async request({url,method,token,contentObject,extraHeaders = null}){
        const headers = {};
        const isFileOrFormData = Util.isFile(contentObject) || Util.isFormData(contentObject);
        if(!isFileOrFormData){
            headers['Content-Type'] = 'application/json';
        }
        if(token){
            headers['Authorization'] = `Bearer ${token}`
        }
        if(extraHeaders){
            for(const prop in extraHeaders){
                headers[prop] = extraHeaders[prop];
            }
        }
        const options = {
            method: method,
            headers: headers
        }
        if(contentObject){
            if(isFileOrFormData){
                options.body = contentObject;
            }else{
                options.body = JSON.stringify(contentObject);
            }
            
        }
        const result = await fetch(url,options);
        return await result.json();
    }
    static async get(args = {url,token,extraHeaders:null}){
        let url = Util.isString(args) ? args : args.url;
        let token = args.token;
        return await this.request({url,token,method:"GET",extraHeaders:args.extraHeaders})
    }
    static async post({url,token,contentObject}){
        return await this.request({url,token,contentObject,method:"POST"})
    }
    static async put({url,token,contentObject}){
        return await this.request({url,token,contentObject,method:"PUT"})
    }
    static async delete({url,token}){
        return await this.request({url,token,method:"DELETE"})
    }
}