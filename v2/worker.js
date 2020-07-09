onmessage = async e => {
    try{
        const file = e.data.file;
        const clazz = e.data.clazz;
        const imported = (await import(file))[clazz];
        const func = e.data.func;
        const args = e.data.args;
        const result = imported[func](args);
        postMessage(result);
    }catch(error){
        postMessage(error);
    }
};