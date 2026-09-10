/** Menü Dedektifi — yerleşik soru havuzu (TR/EN). Admin soruları önceliklidir. */

export type DetectiveLocalizedQuestion = {
  id: string;
  prompt: { tr: string; en: string };
  choices: { tr: [string, string, string, string]; en: [string, string, string, string] };
  correctIndex: 0 | 1 | 2 | 3;
};

export type DetectivePlayQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  fromAdmin?: boolean;
};

function q(
  id: string,
  tr: string,
  en: string,
  trC: [string, string, string, string],
  enC: [string, string, string, string],
  c: 0 | 1 | 2 | 3
): DetectiveLocalizedQuestion {
  return { id, prompt: { tr, en }, choices: { tr: trC, en: enC }, correctIndex: c };
}

export const DETECTIVE_QUESTION_POOL: DetectiveLocalizedQuestion[] = [
  q('d01', 'Espresso hangi ülkenin ikonik kahvesidir?', 'Espresso is the iconic coffee of which country?', ['Fransa', 'İtalya', 'İspanya', 'Portekiz'], ['France', 'Italy', 'Spain', 'Portugal'], 1),
  q('d02', 'Sushi geleneksel olarak hangi ülkeye aittir?', 'Sushi traditionally belongs to which country?', ['Çin', 'Kore', 'Japonya', 'Tayland'], ['China', 'Korea', 'Japan', 'Thailand'], 2),
  q('d03', 'Mozzarella peyniri genelde hangi yemekte kullanılır?', 'Mozzarella cheese is commonly used in which dish?', ['Sushi', 'Pizza', 'Humus', 'Baklava'], ['Sushi', 'Pizza', 'Hummus', 'Baklava'], 1),
  q('d04', 'Guacamole’nin ana malzemesi nedir?', 'What is the main ingredient of guacamole?', ['Domates', 'Avokado', 'Patlıcan', 'Kabuklu yemiş'], ['Tomato', 'Avocado', 'Eggplant', 'Nuts'], 1),
  q('d05', 'Tiramisunun ana aroması hangisidir?', 'What is the main flavor note of tiramisu?', ['Vanilya', 'Kahve', 'Çilek', 'Limon'], ['Vanilla', 'Coffee', 'Strawberry', 'Lemon'], 1),
  q('d06', 'Paella hangi mutfağa aittir?', 'Paella belongs to which cuisine?', ['İtalyan', 'Yunan', 'İspanyol', 'Fas'], ['Italian', 'Greek', 'Spanish', 'Moroccan'], 2),
  q('d07', 'Wasabi genelde neyle servis edilir?', 'Wasabi is usually served with what?', ['Pizza', 'Sushi', 'Steak', 'Çorba'], ['Pizza', 'Sushi', 'Steak', 'Soup'], 1),
  q('d08', 'Humusun temel baklagili nedir?', 'What is the main legume in hummus?', ['Mercimek', 'Nohut', 'Fasulye', 'Bezelye'], ['Lentils', 'Chickpeas', 'Beans', 'Peas'], 1),
  q('d09', 'Croissant hangi ülkeyle özdeşleşir?', 'Which country is the croissant associated with?', ['Belçika', 'Fransa', 'İsviçre', 'Avusturya'], ['Belgium', 'France', 'Switzerland', 'Austria'], 1),
  q('d10', 'Kimchi hangi mutfağa aittir?', 'Kimchi belongs to which cuisine?', ['Japon', 'Çin', 'Kore', 'Vietnam'], ['Japanese', 'Chinese', 'Korean', 'Vietnamese'], 2),
  q('d11', 'Baklava geleneksel olarak nasıl tatlandırılır?', 'How is baklava traditionally sweetened?', ['Tuz', 'Şerbet / bal', 'Sirke', 'Hardal'], ['Salt', 'Syrup / honey', 'Vinegar', 'Mustard'], 1),
  q('d12', 'Risotto’nun ana tahılı nedir?', 'What is the main grain in risotto?', ['Bulgur', 'Kuskus', 'Pirinç', 'Yulaf'], ['Bulgur', 'Couscous', 'Rice', 'Oats'], 2),
  q('d13', 'Gazpacho nasıl servis edilir?', 'How is gazpacho typically served?', ['Sıcak', 'Soğuk', 'Dondurulmuş', 'Kızartılmış'], ['Hot', 'Cold', 'Frozen', 'Fried'], 1),
  q('d14', 'Parmesan peyniri hangi ülkeye aittir?', 'Parmesan cheese belongs to which country?', ['İtalya', 'Fransa', 'Hollanda', 'Yunanistan'], ['Italy', 'France', 'Netherlands', 'Greece'], 0),
  q('d15', 'Tempura hangi pişirme yöntemidir?', 'Tempura is which cooking method?', ['Haşlama', 'Buhar', 'Kızartma', 'Füme'], ['Boiling', 'Steaming', 'Frying', 'Smoking'], 2),
  q('d16', 'Ceviche’nin ana prensibi nedir?', 'What is the main principle of ceviche?', ['Uzun fırınlama', 'Narenciye ile marine', 'Derin yağda kızartma', 'Fermente et'], ['Long baking', 'Citrus marinade', 'Deep frying', 'Fermented meat'], 1),
  q('d17', 'Matcha nedir?', 'What is matcha?', ['Yeşil çay tozu', 'Kahve çekirdeği', 'Kakao', 'Baharat karışımı'], ['Green tea powder', 'Coffee bean', 'Cocoa', 'Spice mix'], 0),
  q('d18', 'Falafel genelde neden yapılır?', 'Falafel is usually made from what?', ['Et', 'Nohut / baklagil', 'Balık', 'Peynir'], ['Meat', 'Chickpeas / legumes', 'Fish', 'Cheese'], 1),
  q('d19', 'Borscht hangi rengi ile bilinir?', 'What color is borscht known for?', ['Yeşil', 'Kırmızı', 'Sarı', 'Mor'], ['Green', 'Red', 'Yellow', 'Purple'], 1),
  q('d20', 'Pesto sosunun klasik yeşili hangisidir?', 'What is the classic green in pesto?', ['Maydanoz', 'Fesleğen', 'Nane', 'Roka'], ['Parsley', 'Basil', 'Mint', 'Arugula'], 1),
  q('d21', 'Taco hangi mutfağa aittir?', 'Tacos belong to which cuisine?', ['İtalyan', 'Meksika', 'Hint', 'Türk'], ['Italian', 'Mexican', 'Indian', 'Turkish'], 1),
  q('d22', 'Pho çorbası hangi ülkeye aittir?', 'Pho soup belongs to which country?', ['Tayland', 'Vietnam', 'Japonya', 'Çin'], ['Thailand', 'Vietnam', 'Japan', 'China'], 1),
  q('d23', 'Safran (saffron) ne için kullanılır?', 'What is saffron mainly used for?', ['Renk ve aroma', 'Kıvam artırıcı', 'Maya', 'Tatlandırıcı şeker'], ['Color and aroma', 'Thickener', 'Yeast', 'Sweetener sugar'], 0),
  q('d24', 'Bruschetta genelde hangi ekmekle yapılır?', 'Bruschetta is usually made with which bread?', ['Simit', 'Kızarmış dilim ekmek', 'Lavaş', 'Bagel'], ['Simit', 'Toasted sliced bread', 'Lavash', 'Bagel'], 1),
  q('d25', 'Miso çorbasının temeli nedir?', 'What is the base of miso soup?', ['Domates', 'Fermente soya macunu', 'Krema', 'Mercimek'], ['Tomato', 'Fermented soybean paste', 'Cream', 'Lentils'], 1),
  q('d26', 'Gelato İtalyan mutfağında neyi ifade eder?', 'What does gelato mean in Italian cuisine?', ['Pizza', 'Dondurma', 'Makarna', 'Peynir'], ['Pizza', 'Ice cream', 'Pasta', 'Cheese'], 1),
  q('d27', 'Ratatouille hangi sebzelerle yapılır?', 'Ratatouille is made mainly with what?', ['Meyveler', 'Sebzeler', 'Deniz ürünleri', 'Tahıllar'], ['Fruits', 'Vegetables', 'Seafood', 'Grains'], 1),
  q('d28', 'Naan ekmeği hangi mutfakla anılır?', 'Naan bread is associated with which cuisine?', ['Hint', 'Japon', 'Meksika', 'İskandinav'], ['Indian', 'Japanese', 'Mexican', 'Nordic'], 0),
  q('d29', 'Aioli klasik olarak ne içerir?', 'Classic aioli contains what?', ['Sarımsak', 'Çikolata', 'Nane', 'Ananas'], ['Garlic', 'Chocolate', 'Mint', 'Pineapple'], 0),
  q('d30', 'Dim sum hangi mutfağa aittir?', 'Dim sum belongs to which cuisine?', ['Tay', 'Çin', 'Yunan', 'İtalyan'], ['Thai', 'Chinese', 'Greek', 'Italian'], 1),
  q('d31', 'Türk mutfağında “mezze” ne anlama gelir?', 'In Turkish cuisine, what does “mezze” mean?', ['Ana yemek', 'Küçük paylaşım tabakları', 'Tatlı', 'İçecek'], ['Main course', 'Small sharing plates', 'Dessert', 'Drink'], 1),
  q('d32', 'Lahmacun genelde nasıl yenir?', 'How is lahmacun usually eaten?', ['Tatlı olarak', 'Rulo yapılıp', 'Çorba gibi', 'Dondurularak'], ['As dessert', 'Rolled up', 'Like soup', 'Frozen'], 1),
  q('d33', 'Çayın dünyada en çok tüketildiği ülkelerden biri hangisidir?', 'Which is among countries where tea is most consumed?', ['Türkiye', 'İzlanda', 'Şili', 'Fiji'], ['Turkey', 'Iceland', 'Chile', 'Fiji'], 0),
  q('d34', 'Menemen’in ana malzemelerinden biri nedir?', 'What is a main ingredient of menemen?', ['Yumurta', 'Pirinç', 'Makarna', 'Balık'], ['Egg', 'Rice', 'Pasta', 'Fish'], 0),
  q('d35', 'Ayran hangi iki malzemeden yapılır?', 'Ayran is made from which two ingredients?', ['Süt + limon', 'Yoğurt + su', 'Kaymak + bal', 'Peynir + yağ'], ['Milk + lemon', 'Yogurt + water', 'Cream + honey', 'Cheese + oil'], 1),
  q('d36', 'Künefe genelde hangi peynirle yapılır?', 'Künefe is usually made with which cheese?', ['Cheddar', 'Tuzsuz tel peynir', 'Roquefort', 'Mascarpone'], ['Cheddar', 'Unsalted string cheese', 'Roquefort', 'Mascarpone'], 1),
  q('d37', 'İskender kebap hangi sosla bilinir?', 'İskender kebab is known for which sauce?', ['Pesto', 'Tereyağlı domates sosu', 'Soya sosu', 'Tatlı chili'], ['Pesto', 'Buttery tomato sauce', 'Soy sauce', 'Sweet chili'], 1),
  q('d38', 'Çiğ köfte geleneksel olarak nasıl “pişer”?', 'How does traditional çiğ köfte “cook”?', ['Fırında', 'Yoğurularak / baharatla', 'Buharda', 'Izgarada'], ['In the oven', 'By kneading / spices', 'Steamed', 'On the grill'], 1),
  q('d39', 'Türk kahvesi nasıl demlenir?', 'How is Turkish coffee brewed?', ['Filtre makinesi', 'Cezvede', 'French press', 'Cold brew'], ['Filter machine', 'In a cezve (pot)', 'French press', 'Cold brew'], 1),
  q('d40', 'Mantı genelde neyle servis edilir?', 'Mantı is usually served with what?', ['Ketçap', 'Yoğurt ve sos', 'Hardal', 'Mayonez'], ['Ketchup', 'Yogurt and sauce', 'Mustard', 'Mayonnaise'], 1),
  q('d41', 'Umami tadı hangi lezzeti tanımlar?', 'What taste does umami describe?', ['Tatlı', 'Ekşi', 'Tuzlu-etli derinlik', 'Acı'], ['Sweet', 'Sour', 'Savory depth', 'Bitter'], 2),
  q('d42', 'Al dente makarna ne demektir?', 'What does al dente pasta mean?', ['Çok yumuşak', 'Dişe gelecek kıvam', 'Çiğ', 'Yanmış'], ['Very soft', 'Firm to the bite', 'Raw', 'Burnt'], 1),
  q('d43', 'Sommelier ne iş yapar?', 'What does a sommelier do?', ['Şef', 'Şarap uzmanı', 'Sadece temizlik', 'Kasap'], ['Chef', 'Wine specialist', 'Only cleaning', 'Butcher'], 1),
  q('d44', 'Amuse-bouche nedir?', 'What is an amuse-bouche?', ['Ana yemek', 'Küçük karşılama lokması', 'Hesap', 'Menü kapağı'], ['Main course', 'Tiny welcome bite', 'The bill', 'Menu cover'], 1),
  q('d45', 'Mise en place ne anlama gelir?', 'What does mise en place mean?', ['Hesabı kapatmak', 'Hazırlık düzeni', 'Masayı bozmak', 'Menüyü basmak'], ['Closing the bill', 'Prep organization', 'Messing the table', 'Printing the menu'], 1),
  q('d46', 'Gluten hangi tahıllarda bulunur?', 'Gluten is found in which grains?', ['Pirinç', 'Buğday / arpa / çavdar', 'Saf mısır nişastası', 'Her zaman kinoa'], ['Rice', 'Wheat / barley / rye', 'Pure corn starch', 'Always quinoa'], 1),
  q('d47', 'Laktoz intoleransı neyi zorlaştırır?', 'Lactose intolerance makes what harder?', ['Su içmek', 'Süt ürünlerini sindirmek', 'Tuz yemek', 'Baharat kullanmak'], ['Drinking water', 'Digesting dairy', 'Eating salt', 'Using spices'], 1),
  q('d48', 'Vegan beslenmede hangisi yenmez?', 'In a vegan diet, which is not eaten?', ['Sebze', 'Hayvansal ürünler', 'Meyve', 'Tahıl'], ['Vegetables', 'Animal products', 'Fruit', 'Grains'], 1),
  q('d49', 'Sous-vide pişirme ne kullanır?', 'What does sous-vide cooking use?', ['Açık alev', 'Vakumlu su banyosu', 'Sadece mikrodalga', 'Kuru buz'], ['Open flame', 'Vacuum water bath', 'Only microwave', 'Dry ice'], 1),
  q('d50', 'Fermantasyon örneği hangisidir?', 'Which is an example of fermentation?', ['Yoğurt', 'Haşlanmış patates', 'Buz', 'Tuz'], ['Yogurt', 'Boiled potato', 'Ice', 'Salt'], 0),
  q('d51', 'Truffle (truf) nedir?', 'What is a culinary truffle?', ['Mantar türü', 'Balık', 'Peynir markası', 'Çay'], ['A type of fungus', 'Fish', 'A cheese brand', 'Tea'], 0),
  q('d52', 'Cappuccino klasik olarak ne içerir?', 'A classic cappuccino contains what?', ['Sadece espresso', 'Espresso + köpüklü süt', 'Sadece süt', 'Zorunlu kakao şurubu'], ['Only espresso', 'Espresso + foamed milk', 'Only milk', 'Must have cocoa syrup'], 1),
  q('d53', 'Latte ile cappuccino farkı genelde nedir?', 'What usually differs latte from cappuccino?', ['Latte daha sütlüdür', 'Latte hep soğuktur', 'Cappuccino’da kahve yok', 'Hiç fark yok'], ['Latte has more milk', 'Latte is always cold', 'Cappuccino has no coffee', 'No difference'], 0),
  q('d54', 'Smoothie genelde nasıl hazırlanır?', 'How is a smoothie usually made?', ['Kızartılarak', 'Blenderda karıştırılarak', 'Füme edilerek', 'Mayalanarak'], ['By frying', 'Blended', 'By smoking', 'By fermenting'], 1),
  q('d55', 'Mocktail nedir?', 'What is a mocktail?', ['Sıcak çorba', 'Alkolsüz kokteyl', 'Et dilimi', 'Peynir tabağı'], ['Hot soup', 'Alcohol-free cocktail', 'Meat slice', 'Cheese board'], 1),
  q('d56', 'BBQ sos hangi lezzet profiliyle bilinir?', 'BBQ sauce is known for which flavor profile?', ['Tatlı-dumanlı', 'Sadece acı limon', 'Saf vanilya', 'Sadece nane'], ['Sweet-smoky', 'Only sour lemon', 'Pure vanilla', 'Only mint'], 0),
  q('d57', 'Waffle hangi pişirme aracıyla yapılır?', 'What tool is used to cook waffles?', ['Waffle makinesi', 'Sushi matı', 'Tandoor', 'Fondü potu'], ['Waffle iron', 'Sushi mat', 'Tandoor', 'Fondue pot'], 0),
  q('d58', 'Pancake hamuru genelde ne içerir?', 'Pancake batter usually contains what?', ['Un + yumurta + süt', 'Sadece yağ', 'Sadece tuz', 'Sadece buz'], ['Flour + egg + milk', 'Only oil', 'Only salt', 'Only ice'], 0),
  q('d59', 'Cheesecake’in ana malzemelerinden biri nedir?', 'What is a main ingredient of cheesecake?', ['Krem peynir', 'Balık', 'Lahana', 'Mercimek'], ['Cream cheese', 'Fish', 'Cabbage', 'Lentils'], 0),
  q('d60', 'Brownie hangi tatta öne çıkar?', 'What flavor do brownies highlight?', ['Çikolata', 'Nane balığı', 'Soğan', 'Hardal'], ['Chocolate', 'Mint fish', 'Onion', 'Mustard'], 0),
  q('d61', 'Ramen’in temel unsurlarından biri nedir?', 'What is a core element of ramen?', ['Erişte + et suyu', 'Sadece dondurma', 'Sadece ekmek', 'Sadece salata'], ['Noodles + broth', 'Only ice cream', 'Only bread', 'Only salad'], 0),
  q('d62', 'Gyoza nedir?', 'What is gyoza?', ['Japon mantısı', 'İtalyan pizza', 'Türk tatlısı', 'Fransız çorbası'], ['Japanese dumpling', 'Italian pizza', 'Turkish dessert', 'French soup'], 0),
  q('d63', 'Tzatziki hangi malzemeleri içerir?', 'What does tzatziki include?', ['Yoğurt + salatalık', 'Çikolata + kahve', 'Pirinç + soya', 'Balık + hardal'], ['Yogurt + cucumber', 'Chocolate + coffee', 'Rice + soy', 'Fish + mustard'], 0),
  q('d64', 'Moussaka hangi mutfakla anılır?', 'Moussaka is associated with which cuisine?', ['Yunan', 'Meksika', 'Japon', 'Hint'], ['Greek', 'Mexican', 'Japanese', 'Indian'], 0),
  q('d65', 'Couscous hangi tahıl ürünüdür?', 'Couscous is which kind of grain product?', ['İnce bulgur benzeri semolina', 'Saf et', 'Saf balık', 'Saf peynir'], ['Fine semolina-like grain', 'Pure meat', 'Pure fish', 'Pure cheese'], 0),
  q('d66', 'Tapas neyi ifade eder?', 'What does tapas refer to?', ['İspanyol küçük tabaklar', 'Japon çay seremonisi', 'Türk kahvaltı tabağı değil', 'Sadece tatlı'], ['Spanish small plates', 'Japanese tea ceremony', 'Not a Turkish breakfast plate', 'Only dessert'], 0),
  q('d67', 'Fondü klasik olarak neyle yapılır?', 'Classic fondue is made with what?', ['Eritilmiş peynir', 'Dondurulmuş meyve', 'Çiğ patates', 'Kuru makarna'], ['Melted cheese', 'Frozen fruit', 'Raw potato', 'Dry pasta'], 0),
  q('d68', 'Carbonara klasik sosunda hangisi vardır?', 'Classic carbonara sauce includes what?', ['Yumurta + peynir', 'Krema zorunlu her zaman', 'Ketçap', 'Bal'], ['Egg + cheese', 'Always mandatory cream', 'Ketchup', 'Honey'], 0),
  q('d69', 'Bolognese sosu hangi yemekle sık eşleşir?', 'Bolognese sauce is often paired with what?', ['Makarna', 'Sushi', 'Baklava', 'Dondurma'], ['Pasta', 'Sushi', 'Baklava', 'Ice cream'], 0),
  q('d70', 'Gnocchi genelde neden yapılır?', 'Gnocchi is usually made from what?', ['Patates + un', 'Sadece balık', 'Sadece çikolata', 'Sadece buz'], ['Potato + flour', 'Only fish', 'Only chocolate', 'Only ice'], 0),
  q('d71', 'Ceviz hangi tatlıda sık kullanılır?', 'Walnuts are often used in which dessert?', ['Baklava', 'Sushi', 'Pizza marinara', 'Gazpacho'], ['Baklava', 'Sushi', 'Marinara pizza', 'Gazpacho'], 0),
  q('d72', 'Zeytinyağı hangi mutfağın temelidir?', 'Olive oil is a cornerstone of which cuisine style?', ['Akdeniz', 'Kutup mutfağı', 'Sadece fast food', 'Sadece tatlı'], ['Mediterranean', 'Arctic cuisine', 'Only fast food', 'Only desserts'], 0),
  q('d73', 'Feta peyniri hangi ülkeyle anılır?', 'Feta cheese is associated with which country?', ['Yunanistan', 'Japonya', 'Meksika', 'Hindistan'], ['Greece', 'Japan', 'Mexico', 'India'], 0),
  q('d74', 'Halloumi peyniri nasıl pişirilir?', 'How is halloumi often cooked?', ['Izgara / tavada', 'Çiğ dondurma gibi', 'Sadece buharda çikolata', 'Mikrodalgada buz'], ['Grilled / pan-seared', 'Like raw ice cream', 'Only steamed chocolate', 'Microwave ice'], 0),
  q('d75', 'Çedar peyniri hangi renkle bilinir?', 'Cheddar is often known for which color?', ['Turuncu-sarı ton', 'Parlak mavi zorunlu', 'Şeffaf', 'Mor neon'], ['Orange-yellow tones', 'Must be bright blue', 'Transparent', 'Neon purple'], 0),
  q('d76', 'Prosciutto nedir?', 'What is prosciutto?', ['İtalyan kurutulmuş jambon', 'Japon çay', 'Türk lokum', 'Fransız baget'], ['Italian cured ham', 'Japanese tea', 'Turkish lokum', 'French baguette'], 0),
  q('d77', 'Chorizo hangi lezzetle bilinir?', 'Chorizo is known for which character?', ['Baharatlı sosis', 'Tatlı puding', 'Yeşil salata', 'Buzlu çay'], ['Spicy sausage', 'Sweet pudding', 'Green salad', 'Iced tea'], 0),
  q('d78', 'Sushi’de nori nedir?', 'What is nori in sushi?', ['Deniz yosunu yaprağı', 'Pirinç sosu', 'Wasabi kökü', 'Soya fasulyesi'], ['Seaweed sheet', 'Rice sauce', 'Wasabi root', 'Soybean'], 0),
  q('d79', 'Sashimi sushi’den nasıl ayrılır?', 'How does sashimi differ from sushi?', ['Genelde pirinçsiz dilim', 'Her zaman pizza üstü', 'Her zaman tatlı', 'Her zaman çorba'], ['Usually sliced without rice', 'Always on pizza', 'Always dessert', 'Always soup'], 0),
  q('d80', 'Teriyaki sosu hangi tatta öne çıkar?', 'What flavor does teriyaki sauce highlight?', ['Tatlı-tuzlu glaze', 'Saf limon acısı', 'Sadece vanilya', 'Sadece nane'], ['Sweet-savory glaze', 'Pure lemon bitterness', 'Only vanilla', 'Only mint'], 0),
  q('d81', 'Pad Thai hangi ülkeye aittir?', 'Pad Thai belongs to which country?', ['Tayland', 'İtalya', 'Meksika', 'Fas'], ['Thailand', 'Italy', 'Mexico', 'Morocco'], 0),
  q('d82', 'Biryani hangi mutfakla anılır?', 'Biryani is associated with which cuisine?', ['Hint / Güney Asya', 'İskandinav', 'Kutup', 'Sadece Meksika'], ['Indian / South Asian', 'Nordic', 'Arctic', 'Only Mexican'], 0),
  q('d83', 'Curry’nin ortak özelliği nedir?', 'What is a common trait of curry?', ['Baharatlı sos / karışım', 'Sadece dondurma', 'Sadece ekmek', 'Sadece su'], ['Spiced sauce / mix', 'Only ice cream', 'Only bread', 'Only water'], 0),
  q('d84', 'Nasi goreng ne demektir?', 'What does nasi goreng mean?', ['Kızarmış pirinç', 'Soğuk çorba', 'Peynir tabağı', 'Balık pastası'], ['Fried rice', 'Cold soup', 'Cheese board', 'Fish pie'], 0),
  q('d85', 'Satay genelde neyle servis edilir?', 'Satay is often served with what?', ['Fıstık sosu', 'Çikolata sosu', 'Vanilya kreması', 'Hardal balı'], ['Peanut sauce', 'Chocolate sauce', 'Vanilla cream', 'Honey mustard'], 0),
  q('d86', 'Empanada nedir?', 'What is an empanada?', ['İçi doldurulmuş hamur', 'Japon çorba', 'Türk lokum', 'İtalyan dondurma'], ['Stuffed pastry', 'Japanese soup', 'Turkish lokum', 'Italian gelato'], 0),
  q('d87', 'Ceviche hangi kıtayla sık anılır?', 'Ceviche is often linked to which region?', ['Latin Amerika', 'Kuzey Kutbu', 'İç Moğolistan', 'Sadece İskandinavya'], ['Latin America', 'North Pole', 'Inner Mongolia', 'Only Scandinavia'], 0),
  q('d88', 'Poke bowl hangi mutfaktan esinlenir?', 'Poke bowls are inspired by which cuisine?', ['Hawaii / Pasifik', 'Sadece Alman', 'Sadece Rus', 'Sadece Fas'], ['Hawaiian / Pacific', 'Only German', 'Only Russian', 'Only Moroccan'], 0),
  q('d89', 'Acai bowl’un temeli nedir?', 'What is the base of an acai bowl?', ['Acai püre / meyve', 'Kızarmış et', 'Peynir çorbası', 'Sade makarna'], ['Acai puree / fruit', 'Fried meat', 'Cheese soup', 'Plain pasta'], 0),
  q('d90', 'Granola genelde ne içerir?', 'What does granola usually include?', ['Yulaf + kuruyemiş', 'Sadece balık', 'Sadece soğan', 'Sadece hardal'], ['Oats + nuts', 'Only fish', 'Only onion', 'Only mustard'], 0),
  q('d91', 'Restoranda “well done” et ne anlama gelir?', 'In restaurants, “well done” meat means what?', ['İyice pişmiş', 'Çiğ', 'Yarım pişmiş zorunlu', 'Dondurulmuş'], ['Fully cooked', 'Raw', 'Must be half-cooked', 'Frozen'], 0),
  q('d92', 'Medium rare steak nasıl pişer?', 'How is a medium rare steak cooked?', ['İçi hafif pembe', 'Tamamen siyah', 'Çiğ ortası buzlu', 'Sadece buharda sebze'], ['Slightly pink inside', 'Completely black', 'Icy raw center', 'Only steamed veggies'], 0),
  q('d93', 'Garson çağırma butonu ne işe yarar?', 'What is a call-waiter button for?', ['Personeli uyarmak', 'Fırını açmak', 'Menüyü silmek', 'Wi-Fi kapatmak'], ['Alerting staff', 'Turning on the oven', 'Deleting the menu', 'Turning off Wi-Fi'], 0),
  q('d94', 'QR menü genelde ne sağlar?', 'What does a QR menu usually provide?', ['Temassız dijital menü', 'Sadece kağıt peçete', 'Sadece masa örtüsü', 'Sadece hesap makinesi'], ['Contactless digital menu', 'Only paper napkins', 'Only tablecloths', 'Only a calculator'], 0),
  q('d95', 'Alerjen bilgisi menüde neden önemlidir?', 'Why is allergen info important on menus?', ['Güvenli seçim için', 'Sadece süs için', 'Fiyat artırmak için', 'Wi-Fi şifresi için'], ['For safer choices', 'Only for decoration', 'To raise prices', 'For the Wi-Fi password'], 0),
  q('d96', 'Vejetaryen menüde genelde ne olmaz?', 'What is usually absent from a vegetarian menu?', ['Et', 'Sebze', 'Meyve', 'Tahıl'], ['Meat', 'Vegetables', 'Fruit', 'Grains'], 0),
  q('d97', 'Çorba servisinde “kase” ne işe yarar?', 'What is a soup bowl for?', ['Sıvı yemeği sunmak', 'Sadece pizza kesmek', 'Sadece hesap yazmak', 'Sadece QR basmak'], ['Serving liquid dishes', 'Only cutting pizza', 'Only writing the bill', 'Only printing QR'], 0),
  q('d98', 'Tatlı kaşığı neden küçüktür?', 'Why is a dessert spoon smaller?', ['Küçük lokmalar için', 'Çorba için zorunlu', 'Et kesmek için', 'Makarna için zorunlu'], ['For smaller bites', 'Mandatory for soup', 'For cutting meat', 'Mandatory for pasta'], 0),
  q('d99', 'Su bardağı masada neden bulunur?', 'Why is a water glass on the table?', ['İçecek sunumu için', 'Sadece süs', 'Sadece hesap tutmak', 'Sadece QR okutmak'], ['For serving drinks', 'Only decoration', 'Only holding the bill', 'Only scanning QR'], 0),
  q('d100', 'İyi bir restoran deneyiminde hangisi önemlidir?', 'What matters in a good restaurant experience?', ['Lezzet + servis', 'Sadece gürültü', 'Sadece karanlık', 'Sadece hızlı hesap'], ['Taste + service', 'Only noise', 'Only darkness', 'Only a fast bill'], 0),
];

export const DETECTIVE_LADDER = [
  500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 250000, 1000000,
] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function localizePoolQuestion(
  item: DetectiveLocalizedQuestion,
  lang: string
): DetectivePlayQuestion {
  const code = (lang || 'tr').split('-')[0].toLowerCase();
  const useTr = code === 'tr' || code === 'az';
  return {
    id: item.id,
    prompt: useTr ? item.prompt.tr : item.prompt.en,
    choices: [...(useTr ? item.choices.tr : item.choices.en)],
    correctIndex: item.correctIndex,
  };
}

export function buildDetectiveRound(
  lang: string,
  adminQuestions: DetectivePlayQuestion[],
  count = DETECTIVE_LADDER.length
): DetectivePlayQuestion[] {
  const admin = adminQuestions
    .filter((q) => q.prompt && q.choices.length >= 4)
    .map((q) => ({
      ...q,
      choices: q.choices.slice(0, 4),
      correctIndex: Math.min(3, Math.max(0, q.correctIndex)),
      fromAdmin: true,
    }));

  const pool = shuffle(DETECTIVE_QUESTION_POOL).map((item) => localizePoolQuestion(item, lang));
  const adminIds = new Set(admin.map((q) => q.id));
  const filler = pool.filter((q) => !adminIds.has(q.id));
  const merged = [...shuffle(admin), ...filler];
  return merged.slice(0, count);
}
