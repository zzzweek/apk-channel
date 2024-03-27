const ApkChannel = (()=>{
    const APK_SIG_V2_BLOCK_ID = 0x7109871A; // v2签名ID
    const APK_SIG_V3_BLOCK_ID = 0xF05368C0; // v3签名ID
    const VERITY_PADDING_BLOCK_ID = 0x42726577; // 填充ID
    const APK_SIGNING_BLOCK_MAGIC = "APK Sig Block 42";
    
    let parts = new Array(4);
    let loaded, v2_sig_block, EOCD, id_block_offset;

    const encoder = new TextEncoder();
    const getNewApkSigningBlock = (id, val) => {
        id |= 0;
        if (!id || id == APK_SIG_V2_BLOCK_ID || id == APK_SIG_V3_BLOCK_ID) {
            throw `写入失败,请检查id是否填写正确`;
        }
        if (id < 0) { // 有符号 -> 无符号
            id = 0xffffffff + id + 1;
        }
        if (id_block_offset[id] !== undefined) {
            throw `写入失败[id:0x${id.toString(16)}已存在],请检查基础包是否正确`;
        }
        let channel_block_size = 8 + 4 + val.toString().length;
        let channel_block = new Uint8Array(channel_block_size);
        let data_view_channel = new DataView(channel_block.buffer);
        data_view_channel.setUint32(0, channel_block_size - 8, true);
        data_view_channel.setUint32(8, id, true);
        channel_block.set(encoder.encode(val), 12);
        let min_padding_size = 8 + 4;
        let new_signing_block_size = (8 + v2_sig_block.size + channel_block_size + min_padding_size + 8 + 16 + 0xfff) >> 12 << 12;
        let padding_block_size = new_signing_block_size - 8 - v2_sig_block.size - channel_block_size - 8 - 16;
        let data_view_padding = new DataView(new ArrayBuffer(padding_block_size));
        data_view_padding.setUint32(0, padding_block_size - 8, true);
        data_view_padding.setUint32(8, VERITY_PADDING_BLOCK_ID , true);
        let data_view_size = new DataView(new ArrayBuffer(8));
        data_view_size.setUint32(0, new_signing_block_size - 8, true);
        return new Blob([data_view_size, v2_sig_block, data_view_channel, data_view_padding, data_view_size, APK_SIGNING_BLOCK_MAGIC]);
    }

    const loadBaseApk = async(file) => {
        if (!file) {
            return false;
        }
        loaded = false;
        EOCD = new DataView(await file.slice(-22).arrayBuffer());
        let eocd_sig = EOCD.getUint32(0,true);
        if (eocd_sig !== 0x06054b50) {
            alert("暂不支持注释区域不为空的基础包");
            return false;
        }
        let central_dir_offset = EOCD.getUint32(16, true); // 中央目录区偏移量
        let v2_sig_magic_number = await file.slice(central_dir_offset - 16, central_dir_offset).text();
        if (v2_sig_magic_number !== APK_SIGNING_BLOCK_MAGIC) {
            alert("基础包不具有v2签名");
            return false;
        }
        let v2_sig_block_len = new DataView(await file.slice(central_dir_offset - 24, central_dir_offset - 20).arrayBuffer()).getUint32(0,true);
        let v2_sig_block_offset = central_dir_offset - v2_sig_block_len - 8;
        v2_sig_block = file.slice(v2_sig_block_offset + 8, central_dir_offset - 24);
        let data_view = new DataView(await v2_sig_block.arrayBuffer());
        id_block_offset = {};
        for (let offset = 0, key_val_len; offset < data_view.byteLength; offset += 8 + key_val_len) {
            key_val_len = data_view.getUint32(offset, true);
            let id = data_view.getUint32(offset + 8, true);
            if (id_block_offset[id]) {
                alert("id error");
                return false;
            }
            id_block_offset[id] = [offset, offset + 8 + key_val_len];
            if (id == VERITY_PADDING_BLOCK_ID) {
                v2_sig_block = new Blob([v2_sig_block.slice(0, offset), v2_sig_block.slice(offset + 8 + key_val_len)]);
            }
        }
        parts[0] = file.slice(0, v2_sig_block_offset); // Contents of ZIP entries
        parts[1] = null; // APK Signing Block
        parts[2] = file.slice(central_dir_offset, -22); // Central Directory
        parts[3] = EOCD; // End of Central Directory
        loaded = true;
        return true;
    }
    const saveAs = (blob, fileName) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || url.substring(url.lastIndexOf('/')+1) + ".apk";
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    const build = (id, val, fileName) => {
        if (!loaded) {
            return false;
        }
        try {
            parts[1] = getNewApkSigningBlock(id, val);
        } catch (e) {
            alert(e);
            return false;
        }
        EOCD.setUint32(16, parts[0].size + parts[1].size, true);
        saveAs(new Blob(parts), fileName);
        return true;
    }
    return {
        loadBaseApk,
        build
    }
})();