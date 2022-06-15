#### yarn 失败

    fatal: unable to access 'https://github.com/frozeman/bignumber.js-nolookahead.git/':
    OpenSSL SSL_read: Connection was reset, errno 10054

#### 解决方案链接
    http://www.9lyp.com/article/info/details/id/76.html
    https://blog.csdn.net/weixin_44751294/article/details/123165555


#### 报错    
    TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received type undefined

#### 解决方式

    1、在package.json中，把"react-scripts": "^3.x.x" 替换为"react-scripts": "^3.4.0"
    2、删除node_modules文件夹
    3、执行npm install 或者 yarn install重新安装依赖包
