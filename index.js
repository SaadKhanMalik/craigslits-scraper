require('dotenv').config()
const puppeteer = require("puppeteer");
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Listing = require('./models/Listings');


async function scrapeListings(page) {
  await page.goto(
    'https://sfbay.craigslist.org/d/software-qa-dba-etc/search/sof'
  );
  const html = await page.content();
  const $ = cheerio.load(html);
  const listings = $(".result-info")
    .map((index, element) => {
      const titleElement = $(element).find(".result-title");
      const timeElement = $(element).find(".result-date");
      const hoodElement = $(element).find(".result-hood");
      const id = index;
      const title = $(titleElement).text();
      const url = $(titleElement).attr('href');
      const datePosted = new Date($(timeElement).attr('datetime'));
      const hood = $(hoodElement).text().trim().replace("(", "").replace(")", "");
      return { id, title, url, datePosted, hood };
    })
    .get();
  return listings;
}

async function connectToMongoDB() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });
  console.log('connected to MongoDB');
}

async function scrapeJobDescriptions(listings, page) {
  for (var i = 0; i < listings.length; i++) {
    await page.goto(listings[i].url)
    const html = await page.content();
    const $ = cheerio.load(html);

    const jobDescriptions = $("#postingbody").text();
    listings[i].jobDescriptions = jobDescriptions;

    const compensation = $('.attrgroup > span:nth-child(1) > b').text();
    listings[i].compensation = compensation;

    const listingModel = new Listing(listings[i]);
    await listingModel.save();

    await sleep(1000);
  }
  return;
}

async function sleep(miliseconds) {
  return new Promise(resolve => setTimeout(resolve, miliseconds));
}

async function main() {
  await connectToMongoDB();
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const listings = await scrapeListings(page);
  const listingWithJebDescription = await scrapeJobDescriptions(
    listings,
    page
  );
  console.log(listings);
}

main();