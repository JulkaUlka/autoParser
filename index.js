import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Car, Admin } from './db.js';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`serve at ${port}`);
});
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: true });

adminBot.onText(/\/start/, async msg => {
  const adminId = msg.from.id;

  // Додаємо до адмінів
  const existingAdmin = await Admin.findOne({ adminId });
  if (!existingAdmin) {
    await new Admin({ adminId }).save();
  }

  await adminBot.sendMessage(adminId, 'Юху, будем шукати нову машинку ✅');

  // Отримуємо всі авто з MongoDB
  const cars = await Car.find();

  if (cars.length === 0) {
    await adminBot.sendMessage(adminId, 'На даний момент авто немає в базі 📭');
  } else {
    await adminBot.sendMessage(adminId, `Наразі в базі ${cars.length} авто:`);

    for (const car of cars) {
      const message = `🚗 ${car.title} (${car.year})\n💰 ${car.price}`;
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Перейти на сайт',
                url: car.link,
              },
            ],
          ],
        },
      };

      await adminBot.sendMessage(adminId, message, options);
    }
  }
});

async function notifyAdmins(car) {
  const admins = await Admin.find();
  const message = `🚗 Нова машина: ${car.title} (${car.year})\n💰 Ціна: ${car.price}`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Перейти на сайт',
            url: car.link,
          },
        ],
      ],
    },
  };

  for (const admin of admins) {
    await adminBot.sendMessage(admin.adminId, message, options);
  }
}

const url = 'https://mazda-vidi.com.ua/ua/used-cars/';

async function fetchCarData() {
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const cars = [];

    $('.car-list__item').each((index, element) => {
      const safeText = selector =>
        $(element).find(selector).text()?.trim() || null;
      const safeAttr = (selector, attr) =>
        $(element).find(selector).attr(attr) || null;

      const title = safeText('.car-list__car--title');
      const yearRaw = safeText(
        '.car-list__price--key:contains("Рік:") + .car-list__price--value'
      );
      const year = yearRaw ? parseInt(yearRaw.replace(/\D/g, '')) : null;

      if (
        title &&
        year &&
        (title.includes('CX-5') || title.includes('CX-30')) &&
        year >= 2020
      ) {
        const mileage = safeText(
          '.car-list__price--key:contains("Пробіг:") + .car-list__price--value'
        );
        const price = safeText(
          '.car-list__price--key:contains("Ціна:") + .car-list__price--value'
        );
        const credit = safeText(
          '.car-list__price--key:contains("Кредит:") + .car-list__price--value'
        );
        const fuel = safeText('.car-list__option-fuel .car-list__option--key');
        const engine = safeText(
          '.car-list__option-fuel .car-list__option--value'
        );
        const drive = safeText(
          '.car-list__option-drive .car-list__option--key'
        );
        const power = safeText(
          '.car-list__option-drive .car-list__option--value'
        );
        const transmission = safeText(
          '.car-list__option-transmission .car-list__option--key'
        );
        const body = safeText(
          '.car-list__option-transmission .car-list__option--value'
        );

        const href = safeAttr('a.car-list__item--button', 'href');
        const carId = href ? href.split('/').pop() : null;
        const link = href ? 'https://mazda-vidi.com.ua' + href : null;

        if (carId) {
          cars.push({
            carId,
            title,
            year,
            mileage,
            price,
            credit,
            fuel,
            engine,
            drive,
            power,
            transmission,
            body,
            link,
          });
        }
      }
    });

    return cars;
  } catch (error) {
    console.error('Помилка при парсингу:', error.message);
    return [];
  }
}

async function checkForNewCars() {
  const newCars = await fetchCarData();
  const savedCarIds = new Set(
    (await Car.find({}, 'carId')).map(car => car.carId)
  );

  const freshCars = newCars.filter(car => !savedCarIds.has(car.carId));

  if (freshCars.length) {
    await Car.insertMany(freshCars);
    console.log(`${freshCars.length} нових авто додано`);

    for (const car of freshCars) {
      await notifyAdmins(car);
    }
  } else {
    console.log('Нових машин немає');
  }
}

// ⏰ Перевірка раз на 4 годин (в мілісекундах: 4 * 60 * 60 * 1000)
setInterval(checkForNewCars, 4 * 60 * 60 * 1000);

// 📦 Перший запуск
checkForNewCars();
