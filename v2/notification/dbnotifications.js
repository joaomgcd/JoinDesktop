export class DBNotifications{
    constructor(db){
        this.db = db;
    }
    async add(notification){        
        if(!notification.tag){
            notification.tag = new Date().getTime().toString();
        }
        await this.db.notifications.put({key:notification.tag,json:JSON.stringify(notification)});
    }    
    async getAll(){
        const {NotificationInfo} = await import("./notificationinfo.js")
        const array = await this.db.notifications.toArray();
        let result = array.map(item=>new NotificationInfo(JSON.parse(item.json)));
        if(!Util.isArray(result)){
            result = [];
        }
        return result;
    }
    async remove(id){
        if(!id) return;

        await this.db.notifications.delete(id);
    }
    async clear(){        
        await this.db.notifications.clear();
    }
}