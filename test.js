import dotenv from 'dotenv';
dotenv.config();

import Queue from 'bull';

const taskQueue = new Queue(process.env.IMAGES_QUEUE, process.env.REDIS_URL);

taskQueue.add({
    postId: "59f85b8e14ec043eabc20827",
    mediaIndex: 0,
    exchangePath: 'http://exchange.memeus.localhost/06ea74db-df28-40b4-b561-85706327910e.jpeg'
});