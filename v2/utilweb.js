class UtilWeb{
    static async request({url,method,token,contentObject}){
        const headers = {};
        const isFileOrFormData = Util.isFile(contentObject) || Util.isFormData(contentObject);
        if(!isFileOrFormData){
            headers['Content-Type'] = 'application/json';
        }
        if(token){
            headers['Authorization'] = `Bearer ${token}`
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
    static async get(args = {url,token}){
        let url = Util.isString(args) ? args : args.url;
        let token = args.token;
        return await this.request({url,token,method:"GET"})
    }
    static async post({url,token,contentObject}){
        return await this.request({url,token,contentObject,method:"POST"})
    }
    static async delete({url,token}){
        return await this.request({url,token,method:"DELETE"})
    }
}