import fs from 'fs';
import CryptoJS from 'crypto-js';
import prompts from 'prompts';
import chalk from 'chalk';
import {
    defaultSetting,
    getCookies,
    balance,
    myInventory,
    purchases,
    itemStatus,
    transactions,
    checkForSell,
    wsCheckForSell,
} from './csmoney-modules/index.js';

const pathSteamDetails = './dataSteam/details.txt';
const pathSteamAndCsMoneyCookies = './dataSteam/allCookies.txt';
const pathSettings = './settings.txt';

(async () => {
    const onCancelPrompts = () => {
        console.log('Завершено пользователем');
        process.exit(0);
    };
    
    const addSteamDetails = async () => {
        const detailsList = [];
        let addData = true;
        
        const questions = [
            {
                type: 'password',
                name: 'login',
                message: 'Введите логин:',
                validate: value => value.length < 4 ? 'Минимальная длина логина - 4' : true,
            },
            {
                type: 'password',
                name: 'password',
                message: 'Введите пароль:',
                validate: value => value.length < 4 ? 'Минимальная длина пароля - 5' : true,
            },
            {
                type: 'password',
                name: 'sharedSecret',
                message: 'Введите shared_secret:',
                validate: value => !value.length ? 'Укажите shared_secret' : true,
            },
            {
                type: 'toggle',
                name: 'shouldAddAccount',
                message: 'Добавить еще один аккаунт Steam?',
                initial: false,
                active: 'Да',
                inactive: 'Нет',
            },
        ];
        
        while (addData) {
            console.log('Введите данные Steam аккаунта.');
            
            const {
                login,
                password,
                sharedSecret,
                shouldAddAccount,
            } = await prompts(questions, {onCancel: onCancelPrompts});
            
            detailsList.push({
                accountName: login,
                password,
                twoFactorCode: sharedSecret,
            });
            
            if (!shouldAddAccount) {
                addData = false;
                break;
            }
        }
        
        for (const details of detailsList) {
            console.log(`Авторизация в Steam аккаунта ${details.accountName.replace(/(?<=^\w+)\w(?!\w?$)/g, '*')}`);
            try {
                await getCookies.loadCookieSteam(details);
            } catch (error) {
                console.log(chalk.red.underline(error));
                return false;
            }
        }
        
        const cryptoData = CryptoJS.AES.encrypt(JSON.stringify(defaultSetting.steamAuthorizationData), global.cryptoPass)
            .toString();
        
        fs.writeFileSync(pathSteamDetails, cryptoData);
        return true;
    };
    
    const addSettings = async () => {
        let isNew = true;
        if (fs.existsSync(pathSettings)) {
            isNew = false;
            const cryptoSteamDetails = fs.readFileSync(pathSettings, 'utf8');
            const bytes = CryptoJS.AES.decrypt(cryptoSteamDetails, global.cryptoPass);
            const settings = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            defaultSetting.set(settings);
        }
        
        const questionsGeneral = [
            {
                type: !isNew ? 'toggle' : null,
                name: 'changeSettings',
                message: 'Изменить общие настройки?',
                initial: false,
                active: 'Да',
                inactive: 'Нет',
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'select' : null,
                name: 'languageName',
                message: 'Какой язык для предметов использовать?',
                choices: [
                    {title: 'Английский', value: 'en', description: 'USP-S | Ticket to Hell (Well-Worn)'},
                    {title: 'Русский', value: 'ru', description: 'MP7 | Кровавый спорт (Закаленное в боях)'},
                ],
                initial: 0,
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'toggle' : null,
                name: 'hasBlackList',
                message: !isNew ? 'Нужно изменить черный список для покупки?' : 'Нужен черный список для покупки?',
                initial: false,
                active: 'Да',
                inactive: 'Нет',
            },
            {
                type: prev => prev ? 'list' : null,
                name: 'blacklist',
                message: 'Укажите предметы, которые не покупать через запятую (USP-S | Ticket to Hell, ...) или оставьте пустым, чтобы очистить черный список:',
                initial: '',
                format: values => values.map(value => value.trim()).filter(value => value),
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'multiselect' : null,
                name: 'appIdList',
                message: 'Для каких игр производить покупку и продажу?',
                choices: [
                    {title: 'CS:GO', value: 730},
                    {title: 'Dota 2', value: 570},
                ],
                min: 1,
            },
        ];
        
        const questionsAccount = [
            {
                type: !isNew ? 'toggle' : null,
                name: 'changeSettings',
                message: 'Изменить настройки для данного аккаунта?',
                initial: false,
                active: 'Да',
                inactive: 'Нет',
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'toggle' : null,
                name: 'isBuyOn',
                message: 'Включить покупку?',
                initial: true,
                active: 'Да',
                inactive: 'Нет',
            },
            {
                type: (_, values) => (values.changeSettings || isNew) && values.isBuyOn ? 'toggle' : null,
                name: 'isBuyOnWhileRefreshBots',
                message: 'Включить покупку при перезагрузке ботов cs.money?',
                initial: true,
                active: 'Да',
                inactive: 'Нет',
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'toggle' : null,
                name: 'isSellOn',
                message: 'Включить продажу?',
                initial: true,
                active: 'Да',
                inactive: 'Нет',
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'number' : null,
                name: 'limitOverstock',
                message: 'Введите допустимый предел оверстока для покупки:',
                initial: -6,
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'number' : null,
                name: 'commission',
                message: 'Введите комиссию на продажу:',
                initial: 7,
                min: 0,
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'number' : null,
                name: 'profitNotOverstock',
                message: 'Введите минимальный профит при покупке предмета не в оверстоке:',
                initial: 10,
                min: 1,
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'number' : null,
                name: 'profitOverstock',
                message: 'Введите минимальный профит при покупке предмета в оверстоке:',
                initial: 16,
                min: 1,
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'number' : null,
                name: 'maxCountParallelsBuying',
                message: 'Введите максимальное количество параллельных покупок:',
                initial: 1,
                min: 1,
                max: 4,
            },
            {
                type: (_, values) => values.changeSettings || isNew ? 'number' : null,
                name: 'maxCountParallelsSelling',
                message: 'Введите максимальное количество параллельных продаж:',
                initial: 2,
                min: 1,
                max: 4,
            },
        ];
        
        const {
            changeSettings: changeGeneralSettings,
            hasBlackList,
            blacklist,
            languageName,
            appIdList,
        } = await prompts(questionsGeneral, {onCancel: onCancelPrompts});
        
        if (isNew || changeGeneralSettings) {
            const settings = {
                languageName,
                appIdList,
            };
            if (hasBlackList) {
                settings.blacklist = blacklist;
            }
            defaultSetting.set(settings);
        }
        
        for (const accountId of Object.keys(defaultSetting.steamAuthorizationData)) {
            console.log(`Настройка аккаунта ${accountId}`);
            
            const {
                changeSettings: changeAccountSettings,
                isBuyOn,
                isBuyOnWhileRefreshBots,
                isSellOn,
                limitOverstock,
                commission,
                profitNotOverstock,
                profitOverstock,
                maxCountParallelsBuying,
                maxCountParallelsSelling,
            } = await prompts(questionsAccount, {onCancel: onCancelPrompts});
            
            if (isNew || changeAccountSettings) {
                const changeProperties = properties => {
                    for (const [key, value] of Object.entries(properties)) {
                        defaultSetting.set({
                            [key]: {
                                ...(defaultSetting[key] || {}),
                                [accountId]: value,
                            },
                        });
                    }
                };
                
                const settings = {
                    isBuyOn,
                    isBuyOnWhileRefreshBots: isBuyOnWhileRefreshBots || false,
                    isSellOn,
                    limitOverstock,
                    commission,
                    profitNotOverstock,
                    profitOverstock,
                    maxCountParallelsBuying,
                    maxCountParallelsSelling,
                };
                changeProperties(settings);
            }
        }
        
        const cryptoData = CryptoJS.AES.encrypt(JSON.stringify(defaultSetting), global.cryptoPass)
            .toString();
        
        fs.writeFileSync(pathSettings, cryptoData);
    };
    
    const start = async () => {
        global.cryptoPass = (await prompts({
            type: 'password',
            name: 'cryptoPass',
            message: 'Введите пароль шифрования:',
            validate: value => value.length < 4 ? 'Минимальная длина пароля - 4' : true,
        }, {onCancel: onCancelPrompts})).cryptoPass;
        
        if (!fs.existsSync(pathSteamDetails)) {
            if (!(await addSteamDetails())) {
                return false;
            }
        }
        
        const cryptoSteamDetails = fs.readFileSync(pathSteamDetails, 'utf8');
        const bytes = CryptoJS.AES.decrypt(cryptoSteamDetails, global.cryptoPass);
        const steamAuthorizationData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        defaultSetting.set({steamAuthorizationData});
        
        await addSettings();
        
        if (fs.existsSync(pathSteamAndCsMoneyCookies)) {
            const cryptoAllCookies = fs.readFileSync(pathSteamAndCsMoneyCookies, 'utf8');
            const bytes = CryptoJS.AES.decrypt(cryptoAllCookies, global.cryptoPass);
            const allCookies = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
            
            getCookies.set(allCookies);
            
            const accountIds = defaultSetting.getAccountIds();
            
            for (const accountId of accountIds) {
                console.log(`Проверка куки аккаунта ${accountId}`);
                const checkCookieCsMoney = await getCookies.checkCookie({accountId});
                
                if (!checkCookieCsMoney) {
                    console.log(`Получение куки аккаунтов`);
                    try {
                        await getCookies.load();
                    } catch (error) {
                        console.log(chalk.red.underline(error));
                        return false;
                    }
                    break;
                }
            }
        } else {
            console.log(`Получение куки аккаунтов`);
            try {
                await getCookies.load();
            } catch (error) {
                console.log(chalk.red.underline(error));
                return false;
            }
        }
        
        const cryptoData = CryptoJS.AES.encrypt(JSON.stringify(getCookies.accounts), global.cryptoPass).toString();
        fs.writeFileSync(pathSteamAndCsMoneyCookies, cryptoData);
        
        return true;
    };
    
    const isLogin = await start();
    
    if (!isLogin) {
        return;
    }
    
    await Promise.all([
        balance.load(),
        myInventory.load(),
        purchases.load(),
        itemStatus.load(),
        transactions.load(),
    ]);
    
    checkForSell({});
    wsCheckForSell({});
})();