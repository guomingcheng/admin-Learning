## 项目路径

https://codesandbox.io/s/8rg3h

## 安装依赖

yarn

## 启动

yarn start

#### 报错    
    TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received type undefined

#### 解决方式

    1、在package.json中，把"react-scripts": "^3.x.x" 替换为"react-scripts": "^3.4.0"
    2、删除node_modules文件夹
    3、执行npm install 或者 yarn install重新安装依赖包
