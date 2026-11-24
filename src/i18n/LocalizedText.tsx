import React, { forwardRef } from 'react';
import {
  Alert as NativeAlert,
  Text as NativeText,
  TextInput as NativeTextInput,
  type AlertButton,
  type AlertOptions,
  type TextInputProps,
  type TextProps,
} from 'react-native';

export type AppLanguage = 'uz' | 'ru' | 'en';
let activeLanguage: AppLanguage = 'uz';

export function setAppLanguage(language: AppLanguage) {
  activeLanguage = language;
}

function normalizeKey(value: string) {
  return value.normalize('NFC').toLocaleLowerCase().replace(/[’‘ʻʼ]/g, "'").replace(/\s+/g, ' ').trim();
}

const phrases: Record<string, readonly [string, string]> = {
  'bosh': ['Home', 'Главная'], 'darslar': ['Lessons', 'Уроки'], 'battle': ['Battle', 'Баттл'],
  'reyting': ['Leaderboard', 'Рейтинг'], 'profil': ['Profile', 'Профиль'], 'salom': ['Hello', 'Здравствуйте'],
  'bilimdon': ['Learner', 'Ученик'],
  'funksiya, fan yoki mavzuni qidiring': ['Search features, subjects or topics', 'Поиск функций, предметов и тем'],
  'funksiyalar': ['FEATURES', 'ФУНКЦИИ'], 'barcha imkoniyatlar': ['ALL FEATURES', 'ВСЕ ВОЗМОЖНОСТИ'],
  'fanlar': ['Subjects', 'Предметы'], 'fanlar va testlar': ['Subjects & quizzes', 'Предметы и тесты'],
  'fanlarni tanlang, mavzularni yeching': ['Choose subjects and practice topics', 'Выбирайте предметы и проходите темы'],
  'raqiblar bilan bilim bellashuvi': ['Compete with other players', 'Соревнуйтесь с другими игроками'],
  'liderlar va natijalarni ko‘ring': ['View leaders and results', 'Смотрите лидеров и результаты'],
  'savol bering, mavzuni tushuning': ['Ask questions and understand topics', 'Задавайте вопросы и изучайте темы'],
  'bilimdonlarni toping va kuzating': ['Discover and follow learners', 'Находите учеников и подписывайтесь'],
  'hisob, avatar va yutuqlaringiz': ['Your account, avatar and achievements', 'Ваш аккаунт, аватар и достижения'],
  'qo‘shimcha tarif va imkoniyatlar': ['More plans and features', 'Больше тарифов и возможностей'],
  'til, mavzu va bildirishnomalar': ['Language, theme and notifications', 'Язык, тема и уведомления'],
  'fanlarni qidiring...': ['Search subjects...', 'Поиск предметов...'],
  'mavzularni qidiring...': ['Search topics...', 'Поиск тем...'], 'mavzular': ['Topics', 'Темы'],
  'barcha fanlar': ['All subjects', 'Все предметы'],
  'o‘zingizga kerakli fanni tanlang va bilim sari yo‘l oling.': ['Choose a subject and start learning.', 'Выберите предмет и начните учиться.'],
  'bilim olamiga xush kelibsiz': ['Welcome to the world of learning', 'Добро пожаловать в мир знаний'],
  'fanni tanlang — mavzularni kashf eting': ['Choose a subject and explore its topics', 'Выберите предмет и изучайте темы'],
  'bu qidiruv bo‘yicha fan topilmadi.': ['No subjects match this search.', 'По этому запросу предметы не найдены.'],
  'bu qidiruv bo‘yicha mavzu topilmadi.': ['No topics match this search.', 'По этому запросу темы не найдены.'],
  'har bir fan ichida mavzular alohida ochiladi.': ['Each subject contains its own topics.', 'В каждом предмете есть отдельные темы.'],
  'bazada saqlanadi': ['Saved in the database', 'Сохранено в базе данных'],
  'shaxsiy ai ustoz': ['Personal AI Tutor', 'Личный ИИ-наставник'],
  'o‘qishga tayyor': ['Ready to help you learn', 'Готов помочь вам учиться'],
  'salom! men sizning ai ustozingizman': ['Hello! I am your AI tutor', 'Здравствуйте! Я ваш ИИ-наставник'],
  'ai ustoz javob tayyorlamoqda': ['AI tutor is preparing an answer', 'ИИ-наставник готовит ответ'],
  'ai javoblarini muhim ma’lumotlar bilan solishtirib tekshiring': ['Verify AI answers against important information', 'Проверяйте ответы ИИ по важной информации'],
  'savolingizni yozing...': ['Type your question...', 'Введите свой вопрос...'], 'qayta urinish': ['Try again', 'Повторить'],
  'xatolik yuz berdi': ['An error occurred', 'Произошла ошибка'],
  'so‘nggi testlar': ['Recent quizzes', 'Последние тесты'], 'testlar': ['Quizzes', 'Тесты'],
  'test yakunlandi!': ['Quiz completed!', 'Тест завершён!'], 'testni boshlash': ['Start quiz', 'Начать тест'],
  'yangi test ishlash': ['Start another quiz', 'Пройти новый тест'],
  'mavzularga qaytish': ['Back to topics', 'Вернуться к темам'], 'orqaga': ['Back', 'Назад'],
  'savollar umumiy testlar bazasidan olinadi': ['Questions come from the shared quiz bank', 'Вопросы берутся из общей базы тестов'],
  'test sozlamalarini tanlang. savollar bazadan olinadi va birinchi tayyorlangandan keyin qayta ishlatiladi.': ['Choose quiz settings. Questions are stored in the question bank and reused after the first preparation.', 'Выберите настройки теста. Вопросы хранятся в базе и используются повторно после первой подготовки.'],
  'savollar soni': ['NUMBER OF QUESTIONS', 'КОЛИЧЕСТВО ВОПРОСОВ'],
  'qiyinlik darajasi': ['DIFFICULTY', 'СЛОЖНОСТЬ'], 'test tili': ['QUIZ LANGUAGE', 'ЯЗЫК ТЕСТА'],
  'oson': ['Easy', 'Лёгкий'], 'o‘rta': ['Medium', 'Средний'], 'qiyin': ['Hard', 'Сложный'], 'ekspert': ['Expert', 'Эксперт'],
  'o‘zbekcha': ['Uzbek', 'Узбекский'], 'русский': ['Russian', 'Русский'], 'english': ['English', 'Английский'],
  'javobni tanlang': ['Choose an answer', 'Выберите ответ'],
  'to‘g‘ri javoblar soni': ['Correct answers', 'Правильные ответы'],
  'natija statistikaga qo‘shildi': ['Result added to statistics', 'Результат добавлен в статистику'],
  'natija saqlanmadi. qayta urinish': ['Result was not saved. Try again', 'Результат не сохранён. Повторите попытку'],
  'savol': ['Question', 'Вопрос'], 'joriy ball': ['Current score', 'Текущий счёт'],
  'qisqa xulosa': ['Quick summary', 'Краткий итог'],
  'testlar bazasi qanday ishlaydi?': ['How does the quiz bank work?', 'Как работает база тестов?'],
  'natijalar': ['Results', 'Результаты'], 'ta’lim natijalari': ['Learning results', 'Результаты обучения'],
  'battle statistikasi': ['Battle statistics', 'Статистика баттлов'], 'statistika markazi': ['Statistics center', 'Центр статистики'],
  'ta’lim va battle statistikasi yuklanmoqda': ['Loading learning and Battle statistics', 'Загрузка статистики обучения и баттлов'],
  'ta’lim va battle natijalari bir joyda': ['Learning and Battle results in one place', 'Результаты обучения и баттлов в одном месте'],
  'asosiy ko‘rsatkichlar': ['Key metrics', 'Основные показатели'], 'umumiy natija': ['Overall result', 'Общий результат'],
  'g‘alabalar': ['Wins', 'Победы'], 'mag‘lubiyatlar': ['Losses', 'Поражения'],
  'jami ball': ['Total points', 'Всего очков'], 'o‘rtacha ball': ['Average score', 'Средний балл'],
  'g‘alaba': ['Win', 'Победа'], 'mag‘lubiyat': ['Loss', 'Поражение'], 'durang': ['Draw', 'Ничья'],
  'o‘yinlar': ['Matches', 'Матчи'], 'o‘yin rejimlari': ['Game modes', 'Режимы игры'],
  'tez jang': ['Quick match', 'Быстрый бой'], 'oddiy o‘yin': ['Casual match', 'Обычная игра'],
  'ranked': ['Ranked', 'Рейтинговый'], 'reyting uchun': ['For ranking', 'Для рейтинга'],
  'rank ochkolari': ['Rank points', 'Рейтинговые очки'], 'raqib topish': ['Find an opponent', 'Найти соперника'],
  'raqib qidirilmoqda...': ['Searching for an opponent...', 'Поиск соперника...'],
  'qidirishni bekor qilish': ['Cancel search', 'Отменить поиск'],
  'bilim janglari': ['Knowledge battles', 'Битвы знаний'], 'sizning statistikangiz': ['Your statistics', 'Ваша статистика'],
  'batafsil': ['Details', 'Подробнее'], 'oxirgi jang': ['Latest match', 'Последний бой'],
  'tarix': ['History', 'История'], 'battle tarixi hozircha yo‘q': ['No Battle history yet', 'История баттлов пока отсутствует'],
  'statistika hozircha yo‘q': ['No statistics yet', 'Статистики пока нет'],
  'natijalaringiz yuklanmoqda': ['Loading your results', 'Загрузка ваших результатов'],
  'har bir o‘yin — yangi imkoniyat': ['Every match is a new opportunity', 'Каждый матч — новая возможность'],
  'har bir to‘g‘ri javob seni yuqoriga olib chiqadi.': ['Every correct answer moves you up.', 'Каждый правильный ответ поднимает вас выше.'],
  'top bilimdonlar': ['Top learners', 'Лучшие участники'], 'reyting jadvali': ['Leaderboard table', 'Таблица рейтинга'],
  'usta ligasi': ['Master league', 'Лига мастеров'], 'haftalik': ['Weekly', 'За неделю'],
  'oylik': ['Monthly', 'За месяц'], 'hammasi': ['All time', 'За всё время'],
  'profilga qaytish': ['Back to profile', 'Вернуться в профиль'], 'profil topilmadi': ['Profile not found', 'Профиль не найден'],
  'do‘stlar ortiring': ['Find friends', 'Найдите друзей'],
  'quiz arena hamjamiyatidagi foydalanuvchilar': ['People in the QUIZ ARENA community', 'Участники сообщества QUIZ ARENA'],
  'kuzatish': ['Follow', 'Подписаться'], 'kuzatilmoqda': ['Following', 'Вы подписаны'],
  'kuzatuvchilar': ['Followers', 'Подписчики'], 'kuzatilayotganlar': ['Following', 'Подписки'],
  'hozircha tavsiya qilinadigan foydalanuvchi yo‘q.': ['No users to recommend right now.', 'Пока нет рекомендуемых пользователей.'],
  'hozircha do‘stlar tavsiya qilinmagan': ['No friends recommended yet', 'Пока нет рекомендаций друзей'],
  'profilni yopish': ['Close profile', 'Закрыть профиль'], 'sozlamalar': ['Settings', 'Настройки'],
  'edit profile': ['Edit profile', 'Редактировать профиль'], 'profile': ['Profile', 'Профиль'],
  'friends': ['Friends', 'Друзья'], 'shop': ['Shop', 'Магазин'], 'bio': ['Bio', 'О себе'],
  'premium': ['Premium', 'Премиум'],
  'maxsus imkoniyatlar va tariflar': ['Exclusive features and plans', 'Особые возможности и тарифы'],
  'profil uchun qo‘shimcha imkoniyatlar': ['Extra profile features', 'Дополнительные возможности профиля'],
  'tarjimai hol hali kiritilmagan': ['No bio added yet', 'Описание профиля пока не добавлено'],
  'barchasi': ['View all', 'Все'], 'tavsiya etilganlar': ['Recommended', 'Рекомендации'],
  'mukofotlar va bezaklar': ['Rewards and decorations', 'Награды и украшения'],
  'avatar bezaklari': ['Avatar decorations', 'Украшения аватара'], 'avatar bezagi': ['Avatar decoration', 'Украшение аватара'],
  'profil ramkasi': ['Profile frame', 'Рамка профиля'], 'standart ramka': ['Default frame', 'Стандартная рамка'],
  'hozircha bezak tanlanmagan': ['No decoration selected yet', 'Украшение пока не выбрано'],
  'sozlash': ['Customize', 'Настроить'], 'yutuqlar': ['Achievements', 'Достижения'],
  'yutuqlar va medallar': ['Achievements and medals', 'Достижения и медали'],
  'erishgan yutuqlari': ['Achievements', 'Достижения'], 'hozircha yutuqlar yo‘q': ['No achievements yet', 'Пока нет достижений'],
  'mening mukofotlarim': ['My rewards', 'Мои награды'], 'hisobdan chiqish': ['Log out', 'Выйти из аккаунта'],
  'haqiqatan ham chiqmoqchimisiz?': ['Are you sure you want to log out?', 'Вы действительно хотите выйти?'],
  'o‘zgarishlarni saqlash': ['Save changes', 'Сохранить изменения'], 'ismingiz': ['Your name', 'Ваше имя'],
  'ism va familiya': ['Full name', 'Имя и фамилия'], 'username': ['Username', 'Имя пользователя'],
  'o‘zingiz haqingizda...': ['About you...', 'О себе...'],
  'bilimingga ko‘proq imkoniyat': ['More possibilities for your knowledge', 'Больше возможностей для ваших знаний'],
  'premium bilan o‘qish, musobaqa va profilingni yangi darajaga olib chiq': ['Take learning, competition and your profile to the next level with Premium.', 'Выведите обучение, соревнования и профиль на новый уровень с Premium.'],
  'obuna tariflari': ['Subscription plans', 'Тарифы подписки'],
  'obuna holatini yangilash': ['Refresh subscription status', 'Обновить статус подписки'],
  'google play obunasi': ['Google Play subscription', 'Подписка Google Play'],
  'eksklyuziv profil bezaklari va premium nishoni': ['Exclusive profile decorations and Premium badge', 'Эксклюзивные украшения профиля и значок Premium'],
  'kengaytirilgan statistika va maxsus imkoniyatlar': ['Advanced statistics and exclusive features', 'Расширенная статистика и особые возможности'],
  'yangi premium funksiyalari qo‘shilganda foydalanish': ['Access new Premium features as they are released', 'Доступ к новым функциям Premium по мере их появления'],
  'tarif narxi serverda sozlanmagan.': ['This plan has no price configured on the server.', 'Цена этого тарифа не настроена на сервере.'],
  'ko‘rinish': ['APPEARANCE', 'ВНЕШНИЙ ВИД'], 'qorong‘i rejim': ['Dark mode', 'Тёмная тема'],
  'yorug‘ rejim': ['Light mode', 'Светлая тема'],
  'qorong‘i yoki yorug‘ ko‘rinishni tanlang.': ['Choose a dark or light appearance.', 'Выберите тёмное или светлое оформление.'],
  'til': ['LANGUAGE', 'ЯЗЫК'], 'shrift o‘lchami': ['TEXT SIZE', 'РАЗМЕР ТЕКСТА'],
  'kichik': ['Small', 'Маленький'], 'o‘rtacha': ['Medium', 'Средний'], 'katta': ['Large', 'Большой'],
  'bildirishnomalar': ['Notifications', 'Уведомления'], 'ilova xabarlari': ['App notifications', 'Уведомления приложения'],
  'ovoz': ['Sound', 'Звук'], 'tovush effektlari': ['Sound effects', 'Звуковые эффекты'],
  'tebranish': ['Vibration', 'Вибрация'], 'javob berishdagi tebranish': ['Vibration on answer', 'Вибрация при ответе'],
  'hisob va xavfsizlik': ['ACCOUNT & SECURITY', 'АККАУНТ И БЕЗОПАСНОСТЬ'],
  'tiklash email manzili': ['Recovery email', 'Почта для восстановления'],
  'email manzili ulanmagan': ['No email address connected', 'Адрес электронной почты не привязан'],
  'parolni o‘zgartirish': ['Change password', 'Изменить пароль'],
  'hisobingiz parolini yangilang': ['Update your account password', 'Обновите пароль аккаунта'],
  'maxfiylik va xavfsizlik': ['Privacy and security', 'Конфиденциальность и безопасность'],
  'hisob va shaxsiy ma’lumotlar': ['Account and personal data', 'Аккаунт и личные данные'],
  'maxfiylik siyosati': ['Privacy policy', 'Политика конфиденциальности'],
  'ma’lumotlardan foydalanish qoidalari': ['How your data is used', 'Правила использования данных'],
  'yordam': ['Help', 'Помощь'], 'savol berish va yordam': ['Questions and support', 'Вопросы и поддержка'],
  'yordam xizmatiga murojaat': ['Contact support', 'Связаться с поддержкой'],
  'hisob yaratish': ['Create account', 'Создать аккаунт'],
  'xush kelibsiz!': ['Welcome back!', 'С возвращением!'],
  'sizni qayta ko‘rganimizdan xursandmiz': ['GREAT TO SEE YOU AGAIN', 'РАДЫ СНОВА ВАС ВИДЕТЬ'],
  'yangi imkoniyatlar sari': ['A NEW JOURNEY STARTS HERE', 'НАВСТРЕЧУ НОВЫМ ВОЗМОЖНОСТЯМ'],
  'bilim · raqobat · natija': ['KNOWLEDGE · COMPETITION · RESULTS', 'ЗНАНИЯ · СОРЕВНОВАНИЕ · РЕЗУЛЬТАТ'],
  'bilimlar maydoniga qayting.': ['Return to the arena of knowledge.', 'Возвращайтесь на арену знаний.'],
  'o‘z hisobingizni yarating va bilimlar maydoniga qo‘shiling.': ['Create your account and join the arena of knowledge.', 'Создайте аккаунт и присоединяйтесь к арене знаний.'],
  'username kiriting': ['Enter your username', 'Введите имя пользователя'],
  'parol': ['Password', 'Пароль'], 'parolingizni kiriting': ['Enter your password', 'Введите пароль'],
  'parolni unutdingizmi?': ['Forgot your password?', 'Забыли пароль?'],
  'parolni tiklash': ['Reset password', 'Восстановить пароль'],
  'email manzili': ['Email address', 'Адрес электронной почты'],
  'tiklash kodini yuborish': ['Send recovery code', 'Отправить код восстановления'],
  'emailga kelgan 6 xonali kod': ['6-digit code sent to your email', '6-значный код из письма'],
  'yangi parol': ['New password', 'Новый пароль'], 'parolni yangilash': ['Update password', 'Обновить пароль'],
  'kodni qayta yuborish': ['Resend code', 'Отправить код повторно'],
  'kamida 8 ta belgi': ['At least 8 characters', 'Не менее 8 символов'],
  'hisobingiz yo‘qmi?': ['Don’t have an account?', 'Нет аккаунта?'],
  'hisobingiz bormi?': ['Already have an account?', 'Уже есть аккаунт?'],
  'ro‘yxatdan o‘tish': ['Sign up', 'Зарегистрироваться'], 'kirish': ['Log in', 'Войти'],
  'ism xatosi': ['Name error', 'Ошибка имени'], 'username xatosi': ['Username error', 'Ошибка имени пользователя'],
  'email xatosi': ['Email error', 'Ошибка электронной почты'], 'parol xatosi': ['Password error', 'Ошибка пароля'],
  'ism kamida 2 ta belgidan iborat bo‘lsin.': ['Name must contain at least 2 characters.', 'Имя должно содержать не менее 2 символов.'],
  'username 3–30 ta belgi bo‘lsin. lotin harflari, raqamlar va _ ishlating.': ['Username must be 3–30 characters. Use Latin letters, numbers and _ only.', 'Имя пользователя должно содержать 3–30 символов. Используйте латинские буквы, цифры и _ .'],
  'email manzilini to‘g‘ri kiriting.': ['Enter a valid email address.', 'Введите корректный адрес электронной почты.'],
  'parol kamida 8 ta belgidan iborat bo‘lsin.': ['Password must contain at least 8 characters.', 'Пароль должен содержать не менее 8 символов.'],
  'kiritilgan parollar bir xil emas.': ['The passwords do not match.', 'Пароли не совпадают.'],
  'xona': ['Room', 'Комната'], 'javobingiz qabul qilindi.': ['Your answer has been received.', 'Ваш ответ принят.'],
  'vaqt tugadi.': ['Time is up.', 'Время истекло.'], 'savol kutilmoqda...': ['Waiting for the question...', 'Ожидание вопроса...'],
  'natijalaringiz nisbati': ['Your win rate', 'Ваш процент побед'],
  'birinchi battle o‘yinini yakunlaganingizdan so‘ng natijalaringiz shu yerda ko‘rinadi': ['Your results will appear here after your first Battle match.', 'Результаты появятся здесь после первой игры в баттл.'],
  'birinchi testingizni yakunlang — fanlar kesimidagi natijalar shu yerda paydo bo‘ladi': ['Complete your first quiz to see results by subject here.', 'Пройдите первый тест, чтобы увидеть здесь результаты по предметам.'],
  'har bir yakunlangan test bilimlaringiz tarixiga qo‘shiladi': ['Every completed quiz is added to your learning history.', 'Каждый завершённый тест добавляется в историю обучения.'],
  'haftalik o‘qish faolligi': ['Weekly learning activity', 'Недельная активность обучения'],
  'haftalik faollik hali mavjud emas': ['No weekly activity yet', 'Пока нет активности за неделю'],
  'oxirgi 7 kun ichida yakunlangan testlar': ['Quizzes completed in the last 7 days', 'Тесты, пройденные за последние 7 дней'],
  'oxirgi 8 ta yakunlangan urinish': ['Last 8 completed attempts', 'Последние 8 завершённых попыток'],
  'oxirgi 5 ta natija': ['Last 5 results', 'Последние 5 результатов'],
  'umumiy aniqlik': ['Overall accuracy', 'Общая точность'],
  'quiz arena yuklanmoqda': ['Loading QUIZ ARENA...', 'Загрузка QUIZ ARENA...'],
  'quiz arena · liderlar': ['QUIZ ARENA · LEADERS', 'QUIZ ARENA · ЛИДЕРЫ'],
  'mavsum yakunlanishiga 3 kun qoldi': ['3 days left in the season', 'До конца сезона осталось 3 дня'],

  'siz': ['You', 'Вы'],
  'barchasi': ['All', 'Все'],
  'bilim sari o‘sish': ['Learning progress', 'Прогресс обучения'],
  'bilimingni oshir. bellash. natijangni ko‘rsat.': ['Learn more. Compete. Show your results.', 'Учись. Соревнуйся. Покажи свой результат.'],
  'bu bo‘lim keyingi bosqichda ishlab chiqiladi.': ['This section is coming soon.', 'Этот раздел скоро появится.'],
  'battle arena': ['Battle Arena', 'Арена баттлов'],
  'battle g‘alabalari': ['Battle wins', 'Победы в баттлах'],
  'battle natijalari': ['Battle results', 'Результаты баттлов'],
  'battle o‘yinlari': ['Battle matches', 'Игры в баттл'],
  'battle reytingi': ['Battle leaderboard', 'Рейтинг баттлов'],
  'battle reytingi: rp': ['Battle rating: RP', 'Рейтинг баттлов: RP'],
  'birinchi battle o‘yinini yakunlaganingizdan so‘ng natijalaringiz shu yerda ko‘rinadi.': ['Your results will appear here after your first Battle match.', 'Результаты появятся здесь после первой игры в баттл.'],
  'birinchi testingizni yakunlang — fanlar kesimidagi natijalar shu yerda paydo bo‘ladi.': ['Complete your first quiz to see results by subject here.', 'Пройдите первый тест, чтобы увидеть здесь результаты по предметам.'],
  'email (ixtiyoriy)': ['Email (optional)', 'Email (необязательно)'],
  'eng kuchli raqib bilan bilimingizni sinang. har bir savolda 20 soniya!': ['Challenge the strongest opponents. 20 seconds per question!', 'Сразитесь с сильнейшими соперниками. 20 секунд на вопрос!'],
  'erishilgan yutuqlar': ['Achievements unlocked', 'Полученные достижения'],
  'fanlar bo‘yicha natija': ['Subject results', 'Результаты по предметам'],
  'google play': ['Google Play', 'Google Play'],
  'google orqali kirish': ['Continue with Google', 'Войти через Google'],
  'haftalik faollik hali mavjud emas.': ['No weekly activity yet.', 'Пока нет активности за неделю.'],
  'hozircha saqlangan test natijalari yo‘q.': ['No saved quiz results yet.', 'Сохранённых результатов тестов пока нет.'],
  'hozircha yakunlangan o‘yinlar mavjud emas.': ['No completed matches yet.', 'Завершённых матчей пока нет.'],
  'hozirgi tarif: free': ['Current plan: FREE', 'Текущий тариф: FREE'],
  'ingliz tilini qanday o‘rgansam bo‘ladi?': ['How can I learn English?', 'Как мне выучить английский?'],
  'ism va familiya *': ['Full name *', 'Имя и фамилия *'],
  'ismingiz': ['Your name', 'Ваше имя'],
  'jami savollar': ['Total questions', 'Всего вопросов'],
  'javobingiz qabul qilindi.': ['Your answer has been received.', 'Ваш ответ принят.'],
  'joriy ball:': ['Current score:', 'Текущий счёт:'],
  'joriy hisob': ['Current score', 'Текущий счёт'],
  'learning journey': ['LEARNING JOURNEY', 'ПУТЬ ОБУЧЕНИЯ'],
  'mag‘lubiyat': ['Loss', 'Поражение'],
  'mag‘lubiyatlar': ['Losses', 'Поражения'],
  'masalan: ali valiyev': ['For example: Ali Valiyev', 'Например: Али Валиев'],
  'masalan: ali_2026': ['For example: ali_2026', 'Например: ali_2026'],
  'matematikada kasrlarni tushuntirib ber': ['Explain fractions in mathematics', 'Объясни дроби в математике'],
  'mavzuning testlari yuklanmoqda...': ['Loading topic quizzes...', 'Загрузка тестов по теме...'],
  'natija statistika uchun saqlanmoqda...': ['Saving result to statistics...', 'Сохранение результата в статистику...'],
  'natijalaringiz yuklanmoqda...': ['Loading your results...', 'Загрузка ваших результатов...'],
  'oyiga taxminan': ['About per month', 'Примерно в месяц'],
  'o‘yinlar taqsimoti': ['Match breakdown', 'Распределение матчей'],
  'premium faol': ['PREMIUM ACTIVE', 'PREMIUM АКТИВЕН'],
  'parol *': ['Password *', 'Пароль *'],
  'parolingizni kiriting': ['Enter your password', 'Введите пароль'],
  'parolni qayta kiriting': ['Re-enter password', 'Повторите пароль'],
  'parolni tasdiqlang *': ['Confirm password *', 'Подтвердите пароль *'],
  'profil bezaklari': ['Profile decorations', 'Украшения профиля'],
  'quiz arena': ['QUIZ ARENA', 'QUIZ ARENA'],
  "quiz arena / ta'lim": ['QUIZ ARENA / LEARNING', 'QUIZ ARENA / ОБУЧЕНИЕ'],
  'quiz arena premium': ['QUIZ ARENA Premium', 'QUIZ ARENA Premium'],
  'quiz arena rank': ['QUIZ ARENA rank', 'Рейтинг QUIZ ARENA'],
  'quiz arena yuklanmoqda...': ['Loading QUIZ ARENA...', 'Загрузка QUIZ ARENA...'],
  'quiz arena • sozlamalar': ['QUIZ ARENA • Settings', 'QUIZ ARENA • Настройки'],
  'rank natijasi': ['RANK RESULT', 'РЕЗУЛЬТАТ РЕЙТИНГА'],
  'reyting uchun': ['For ranking', 'Для рейтинга'],
  'sizning natijalaringiz': ['YOUR RESULTS', 'ВАШИ РЕЗУЛЬТАТЫ'],
  'sizning statistikangiz': ['Your statistics', 'Ваша статистика'],
  'so‘nggi o‘yinlar': ['Recent matches', 'Последние матчи'],
  'statistika markazi': ['Statistics center', 'Центр статистики'],
  'suhbat tarixi yuklanmoqda...': ['Loading conversation history...', 'Загрузка истории чата...'],
  'ta’limdagi o‘sish va battle natijalaringiz': ['Your learning progress and Battle results', 'Ваш прогресс обучения и результаты баттлов'],
  'test aniqligi': ['Quiz accuracy', 'Точность тестов'],
  'to‘g‘ri javoblar soni': ['Correct answers', 'Правильные ответы'],
  'to‘g‘ri javoblar soni · % aniqlik': ['Correct answers · % accuracy', 'Правильные ответы · точность %'],
  'to‘plangan tajriba': ['Experience earned', 'Накопленный опыт'],
  'umumiy tajriba': ['Total experience', 'Общий опыт'],
  'umumiy natija': ['Overall result', 'Общий результат'],
  'username *': ['Username *', 'Имя пользователя *'],
  'yakuniy hisob': ['Final score', 'Итоговый счёт'],
  'yakunlangan test': ['Completed quiz', 'Завершённый тест'],
  'yordamga murojaat': ['Contact support', 'Обратиться в поддержку'],
  'qorong‘i rejim': ['Dark mode', 'Тёмная тема'],
  'yorug‘ rejim': ['Light mode', 'Светлая тема'],
  'dark mode': ['Dark mode', 'Тёмная тема'],
  'light mode': ['Light mode', 'Светлая тема'],

};

const phraseLookup = new Map<string, readonly [string, string]>(
  Object.entries(phrases).map(([source, translation]) => [normalizeKey(source), translation]),
);

export function translateText(value: string, language: AppLanguage = activeLanguage) {
  if (language === 'uz') return value;
  const key = normalizeKey(value);
  const exact = phraseLookup.get(key);
  if (exact) {
    const leading = value.match(/^\s*/)?.[0] ?? '';
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    return leading + exact[language === 'en' ? 0 : 1] + trailing;
  }

  const count = key.match(/^(\d+)\s+ta\s+(.+)$/);
  if (count) {
    const units: Record<string, readonly [string, string]> = {
      'savol': ['questions', 'вопросов'],
      'mavzu': ['topics', 'тем'],
    };
    const unit = units[normalizeKey(count[2])];
    if (unit) return count[1] + ' ' + unit[language === 'en' ? 0 : 1];
  }

  const followers = key.match(/^(\d+)\s+kuzatuvchi$/);
  if (followers) return followers[1] + (language === 'en' ? ' followers' : ' подписчиков');
  const place = key.match(/^(\d+)-o['’]rin$/);
  if (place) return (language === 'en' ? 'Place ' : 'Место ') + place[1];
  return value;
}

export const LocalizedText = forwardRef<NativeText, TextProps>(
  function LocalizedText({ children, accessibilityLabel, accessibilityHint, ...props }, ref) {
    const localizedChildren = React.Children.map(children, child =>
      typeof child === 'string' ? translateText(child) : child,
    );
    return (
      <NativeText
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel) : accessibilityLabel}
        accessibilityHint={accessibilityHint ? translateText(accessibilityHint) : accessibilityHint}
      >
        {localizedChildren}
      </NativeText>
    );
  },
);
LocalizedText.displayName = 'LocalizedText';

export const LocalizedTextInput = forwardRef<NativeTextInput, TextInputProps>(
  function LocalizedTextInput({ placeholder, accessibilityLabel, accessibilityHint, ...props }, ref) {
    return (
      <NativeTextInput
        ref={ref}
        {...props}
        placeholder={typeof placeholder === 'string' ? translateText(placeholder) : placeholder}
        accessibilityLabel={accessibilityLabel ? translateText(accessibilityLabel) : accessibilityLabel}
        accessibilityHint={accessibilityHint ? translateText(accessibilityHint) : accessibilityHint}
      />
    );
  },
);
LocalizedTextInput.displayName = 'LocalizedTextInput';

export function showLocalizedAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) {
  NativeAlert.alert(
    translateText(title),
    message === undefined ? undefined : translateText(message),
    buttons?.map(button => ({
      ...button,
      text: button.text ? translateText(button.text) : button.text,
    })),
    options,
  );
}
