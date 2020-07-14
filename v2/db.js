let db = null;
class DB{
   static get(){
        if(db != null) return db;

        db = new Dexie("join_app");
        db.version(7).stores({
            devices: 'deviceId,json',
            gcm:'gcmId,json',
            smsThreads:'key,address,deviceId,json',
            contacts:'key,number,deviceId,json',
            smsConversations:'key,address,deviceId,json',
            mediaInfos:'key,json',
            shortcuts:'key,json'
        });
        return db;
   }
}