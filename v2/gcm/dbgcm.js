const fromDbToGcm = async (fromDb)=>{
    const json = fromDb.json;
    const gcmRaw = JSON.parse(json);
    const gcm = await GCMBase.getGCMFromJson(gcmRaw.type,json);
    gcm.gcmId = fromDb.gcmId;
    return gcm;
}
export class DBGCM{
    constructor(db){
        this.db = db;
    }
    async addGcm(gcm){        
        gcm.gcmId = new Date().getTime();
        await this.updateSingle(gcm);
    }
    async updateSingle(gcmForDb){
        await this.db.gcm.put({gcmId:gcmForDb.gcmId,json:JSON.stringify(gcmForDb)});
    }
    async getAll(){
        const array = await this.db.gcm.toArray();
        const gcms = await Promise.all(array.map(item=>fromDbToGcm(item)));
        if(!Util.isArray(gcms)){
            gcms = [];
        }
        return gcms;
    }
    async remove(gcmId){
        if(!gcmId) return;

        await this.db.gcm.delete(gcmId);
    }
    async setDone(gcmId){
        const fromDb = await this.db.gcm.get(gcmId);
        if(!fromDb) return;

        const gcm = await fromDbToGcm(fromDb);
        if(!gcm) return;

        gcm.done = true;
        await this.updateSingle(gcm);
    }
    async clear(){        
        await this.db.gcm.clear();
    }
}