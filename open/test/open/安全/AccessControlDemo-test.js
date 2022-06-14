const { expect } = require("chai");
const { ethers } = require("hardhat");
const { task } = require("hardhat/config");


describe("AccessControlDemo", function () {

    it("Should return the new greeting once it's changed", async function () {

        const AccessControlDemo = await ethers.getContractFactory("AccessControlDemo");
        const accessControlDemo = await AccessControlDemo.deploy();
        accessControlDemo.deployed();

        const [owner , addr1, addr2, addr3] = await ethers.getSigners();

        console.log("合约地址：" + accessControlDemo.address)

        // const accounts = await ethers.getSigners();
        // for (const account of accounts) {
        //     console.log(account.address);
        //   }
        console.log("合约部署者的地址：" + await accessControlDemo.owner());

        let hasRoleTest = await accessControlDemo.hasRoleTest();
        console.log("开始校验，调用 hasRoleTest 函数, 返回值： " + hasRoleTest)
        expect(hasRoleTest).to.equal(1);

        let onlyRoleTest = await accessControlDemo.onlyRoleTest();
        console.log("开始校验，调用 onlyRoleTest 函数，返回值： " + onlyRoleTest);
        expect(onlyRoleTest).to.equal(100);
        
        console.log("\n测试管理员函数： ==============================================================================================================\n");

        //读取角色 bytes32
        let admin = await accessControlDemo.ADMIN();
        console.log("测试当前角色：" + admin)

        console.log(owner.address + " 是否拥有角色权：",  await accessControlDemo.hasRole(admin, owner.address))
        console.log(addr1.address + " 是否拥有角色权：",  await accessControlDemo.hasRole(admin, addr1.address))
        console.log(addr2.address + " 是否拥有角色权：",  await accessControlDemo.hasRole(admin, addr2.address))
        
        console.log("\n角色的管理员： ")
        console.log(await accessControlDemo.getRoleAdmin(admin))

        console.log("\n添加一个账户：")
        await accessControlDemo.connect(addr1).grantRole(admin, addr2.address)

        console.log(addr2.address + " 是否拥有角色权：",  await accessControlDemo.hasRole(admin, addr2.address))




      
    });
  });
  