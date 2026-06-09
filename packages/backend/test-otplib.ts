import { verify } from 'otplib';
async function test() {
  console.log(await verify({ token: '123456', secret: 'abc' }));
}
test();
