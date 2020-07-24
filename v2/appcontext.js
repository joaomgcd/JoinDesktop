
export class AppContext{
    static set context(value){
        Object.assign(_context,value);
    }
    static get context(){
        return _context;
    }
}
const localStorageCache = {};
const getServerStore = () => {
    const Store = require(AppContext.context.serverStorePath);
    return new Store({
        configName: 'localStorage',
        defaults: {}
    });
}
class LocalStorage{
    
    set(key,value){
        if(!value){
            this.delete(key);
            return;
        }
        localStorageCache[key] = value;
        try{
            localStorage.setItem(key,value);
        }catch(error){
            try{
                console.log("Saving to local storage",key, value);
                getServerStore().set(key,value);                
            }catch{
                console.error("Can't save to local storage",error);
                throw error;
            }
        }
    }
    delete(key){        
        delete localStorageCache[key];
        try{
            localStorage.removeItem(key);
        }catch(error){
            try{
                getServerStore().remove(key);
            }catch{
                console.error("Can't delete from local storage",error);
                throw error;
            }
        }
    }
    setObject(key,value){
        this.set(key,JSON.stringify(value));
    }
    get(key){
        if(localStorageCache.hasOwnProperty(key)) return localStorageCache[key];

        try{
            const value = localStorage.getItem(key);
            if(value == "null"){
                value = null;
            }
            return value;
        }catch(error){
            try{
                return getServerStore().get(key);
            }catch{
                console.error("Can't get from local storage",error);
                throw error;
            }
        }
    }
    getBoolean(key){
        const raw = this.get(key);
        if(!raw) return false;

        if(raw == "false") return false;
        return true;
    }
    getObject(key){
        return JSON.parse(this.get(key));
    }
}
var _context = {
    "localStorage":new LocalStorage(),
    "isThisDevice":device => _context.getMyDeviceId() == device.deviceId,
    "getMyDeviceId":() => _context.localStorage.get("myDeviceId"),
    "setMyDeviceId":deviceId => _context.localStorage.set("myDeviceId",deviceId),
    "serverStorePath":"",
    "allowUnsecureContent":false
};