import {
    AddToQueue,
    AddToQueueData, appInfo, FileUtil,
    FromQueue,
    Job,
    JobOverride,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

export class BilibiliTask {

    @JobOverride("video")
    overrideVideoJob(job: Job) {
        const match = job.url().match("/video/av(\\d+).+?([?&]p=(\\d+))?");
        if (match) {
            // 获取av id 和分页信息，组合成新的唯一avId，用于过滤
            const avId = match[1];
            const pNum = match[3] || "0";
            job.key(avId + "_" + pNum);
            job.datas().id = avId;
            job.datas().p = pNum;
        }
    }

    @OnStart({
        urls: "https://www.bilibili.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @AddToQueue([
        {
            name: "video"
        },
        {
            name: "bangumi"
        },
        {
            name: "other"
        }
    ])
    @FromQueue({
        name: "bangumi",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000
    })
    @FromQueue({
        name: "other",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000
    })
    async roam(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());
        await PuppeteerUtil.scrollToBottom(page);
        return await PuppeteerUtil.links(page, {
            video: ".*bilibili.*/video/av.*",
            bangumi: ".*bilibili.*/bangumi/play/.*",
            other: ".*bilibili.*"
        });
    }

    @AddToQueue([
        {
            name: "video"
        },
        {
            name: "bangumi"
        },
        {
            name: "other"
        }
    ])
    @FromQueue({
        name: "video",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000
    })
    async video(page: Page, job: Job): AddToQueueData {
        const id = job.datas().id;
        const p = job.datas().p;

        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        const tagsResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/tag/archive/tags", async response => {
            const tags = PuppeteerUtil.jsonp(await response.text());
            FileUtil.write(appInfo.workplace + "/data/video/" + id + "/" + p + "/tags.json", JSON.stringify(tags));
        });

        await page.goto(job.url());
        await PuppeteerUtil.scrollToBottom(page);
        await tagsResWait;

        return await PuppeteerUtil.links(page, {
            video: ".*bilibili.*/video/av.*",
            bangumi: ".*bilibili.*/bangumi/play/.*",
            other: ".*bilibili.*"
        });
    }

}