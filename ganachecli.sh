#gas limit setado para o maior número possível (53bits no Javascript)

npx ganache-cli -p 42024 -i 5777 --gasLimit 0x1FFFFFFFFFFFFF --gasPrice 2 > /dev/null 2>&1 &
npx ganache-cli -p 9545 -i 5777 --gasLimit 0x1FFFFFFFFFFFFF --gasPrice 2 > /dev/null 2>&1 &
npx ganache-cli -p 18545 -i 5777 --gasLimit 0x1FFFFFFFFFFFFF --gasPrice 2 > /dev/null 2>&1 &
npx ganache-cli -i 5777 --gasLimit 0x1FFFFFFFFFFFFF --gasPrice 2 -p 8545 > /dev/null 2>&1 &
npx ganache-cli -i 5777 --gasLimit 0x1FFFFFFFFFFFFF --gasPrice 2 -p 7545 > /dev/null 2>&1 &
