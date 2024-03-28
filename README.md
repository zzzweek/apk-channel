# apk-channel

一个网页版的安卓渠道包打包工具(只支持V2签名)，所有的数据操作都在本地进行，通过在Apk中的APK Signature Block区块添加自定义的渠道信息来生成渠道包。

PS：这边只是写入渠道信息，基础包里需要自行实现读取这个渠道信息

以`Block Id`为`0x12345678`，`Block Val`为`foo`为例:

```html
<input type="file" onchange="fileSelect(this.files[0])">
<script src="apk-channel.js"></script>
<script>
    let block_id = 0x12345678;
    let block_val = "foo";
    const fileSelect = async(file) {
        if (!file) {
            return;
        }
        let flag = await ApkChannel.loadBaseApk(file);
        if (flag) {
            ApkChannel.build(block_id, block_val);
        }
    }
</script>
```
