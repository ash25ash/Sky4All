enum RequestType {
  medical_emergency,
  call_steward,
  order,
  complaint;

  String toJson() => name;

  static RequestType fromJson(String value) {
    return RequestType.values.firstWhere(
      (e) => e.name == value,
      orElse: () => RequestType.call_steward,
    );
  }
}

enum RequestStatus {
  newRequest('new'),
  seen('seen'),
  in_progress('in_progress'),
  resolved('resolved');

  final String wireName;
  const RequestStatus(this.wireName);

  String toJson() => wireName;

  static RequestStatus fromJson(String value) {
    return RequestStatus.values.firstWhere(
      (e) => e.wireName == value,
      orElse: () => RequestStatus.newRequest,
    );
  }
}

enum SeatStatus { ok, minor, urgent, own, idle }

enum DittoStatus { demo, connecting, live, error }

String normalizeSeatCode(String seat) {
  final trimmed = seat.trim().toUpperCase();
  final letterFirst = RegExp(r'^([A-F])(\d+)$').firstMatch(trimmed);
  if (letterFirst != null) {
    return '${letterFirst.group(2)}${letterFirst.group(1)}';
  }
  return trimmed;
}

bool seatsMatch(String a, String b) {
  return normalizeSeatCode(a) == normalizeSeatCode(b);
}

class Passenger {
  final String id;
  final String name;
  final String seat;
  final String flightId;
  final String flightDate;
  final List<String> medicalConditions;

  const Passenger({
    required this.id,
    required this.name,
    required this.seat,
    required this.flightId,
    this.flightDate = '31/10/2026',
    required this.medicalConditions,
  });

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'name': name,
        'seat': seat,
        'flightId': flightId,
        'flightDate': flightDate,
        'medicalConditions': medicalConditions,
      };

  factory Passenger.fromMap(Map<String, dynamic> map) => Passenger(
        id: (map['id'] ?? map['_id'] ?? '').toString(),
        name: (map['name'] ?? '').toString(),
        seat: (map['seat'] ?? '').toString(),
        flightId: (map['flightId'] ?? 'BA123').toString(),
        flightDate: (map['flightDate'] ?? '31/10/2026').toString(),
        medicalConditions: (map['medicalConditions'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
      );
}

class StewardAccount {
  final String id;
  final String username;
  final String password;
  final String flightNumber;
  final String flightDate;
  final String fullName;

  const StewardAccount({
    required this.id,
    required this.username,
    required this.password,
    required this.flightNumber,
    required this.flightDate,
    required this.fullName,
  });

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'username': username,
        'password': password,
        'flightNumber': flightNumber,
        'flightDate': flightDate,
        'fullName': fullName,
      };
}

class SkyRequest {
  final String id;
  final RequestType type;
  final String seat;
  final String flightId;
  final String flightDate;
  final Map<String, dynamic>? payload;
  final RequestStatus status;
  final int createdAt;

  const SkyRequest({
    required this.id,
    required this.type,
    required this.seat,
    this.flightId = 'BA123',
    this.flightDate = '31/10/2026',
    this.payload,
    required this.status,
    required this.createdAt,
  });

  SkyRequest copyWith({RequestStatus? status}) => SkyRequest(
        id: id,
        type: type,
        seat: seat,
        flightId: flightId,
        flightDate: flightDate,
        payload: payload,
        status: status ?? this.status,
        createdAt: createdAt,
      );

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'type': type.toJson(),
        'seat': seat,
        'flightId': flightId,
        'flightDate': flightDate,
        if (payload != null) 'payload': payload,
        'status': status.toJson(),
        'createdAt': createdAt,
      };

  factory SkyRequest.fromMap(Map<String, dynamic> map) => SkyRequest(
        id: (map['id'] ?? map['_id'] ?? '').toString(),
        type: RequestType.fromJson((map['type'] ?? 'call_steward').toString()),
        seat: (map['seat'] ?? '').toString(),
        flightId: (map['flightId'] ?? 'BA123').toString(),
        flightDate: (map['flightDate'] ?? '31/10/2026').toString(),
        payload: map['payload'] is Map
            ? Map<String, dynamic>.from(map['payload'] as Map)
            : null,
        status: RequestStatus.fromJson((map['status'] ?? 'new').toString()),
        createdAt: (map['createdAt'] as num?)?.toInt() ??
            DateTime.now().millisecondsSinceEpoch,
      );
}

class OrderItem {
  final String name;
  final int qty;

  const OrderItem({required this.name, required this.qty});

  Map<String, dynamic> toMap() => {'name': name, 'qty': qty};

  factory OrderItem.fromMap(Map<String, dynamic> map) => OrderItem(
        name: (map['name'] ?? '').toString(),
        qty: (map['qty'] as num?)?.toInt() ?? 1,
      );
}

class SkyOrder {
  final String id;
  final String seat;
  final String flightId;
  final String flightDate;
  final List<OrderItem> items;
  final RequestStatus status;
  final int createdAt;

  const SkyOrder({
    required this.id,
    required this.seat,
    this.flightId = 'BA123',
    this.flightDate = '31/10/2026',
    required this.items,
    required this.status,
    required this.createdAt,
  });

  SkyOrder copyWith({RequestStatus? status}) => SkyOrder(
        id: id,
        seat: seat,
        flightId: flightId,
        flightDate: flightDate,
        items: items,
        status: status ?? this.status,
        createdAt: createdAt,
      );

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'seat': seat,
        'flightId': flightId,
        'flightDate': flightDate,
        'items': items.map((e) => e.toMap()).toList(),
        'status': status.toJson(),
        'createdAt': createdAt,
      };

  factory SkyOrder.fromMap(Map<String, dynamic> map) => SkyOrder(
        id: (map['id'] ?? map['_id'] ?? '').toString(),
        seat: (map['seat'] ?? '').toString(),
        flightId: (map['flightId'] ?? 'BA123').toString(),
        flightDate: (map['flightDate'] ?? '31/10/2026').toString(),
        items: (map['items'] as List<dynamic>?)
                ?.map((e) => OrderItem.fromMap(Map<String, dynamic>.from(e as Map)))
                .toList() ??
            [],
        status: RequestStatus.fromJson((map['status'] ?? 'new').toString()),
        createdAt: (map['createdAt'] as num?)?.toInt() ??
            DateTime.now().millisecondsSinceEpoch,
      );
}

class FlightRating {
  final String id;
  final String seat;
  final String flightId;
  final String flightDate;
  final int turbulence;
  final int staffBehaviour;
  final int cleanliness;
  final int legroom;
  final int bagSpace;
  final String? comment;
  final int createdAt;

  const FlightRating({
    required this.id,
    required this.seat,
    this.flightId = 'BA123',
    this.flightDate = '31/10/2026',
    required this.turbulence,
    required this.staffBehaviour,
    required this.cleanliness,
    required this.legroom,
    required this.bagSpace,
    this.comment,
    required this.createdAt,
  });

  double get average =>
      (turbulence + staffBehaviour + cleanliness + legroom + bagSpace) / 5.0;

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'seat': seat,
        'flightId': flightId,
        'flightDate': flightDate,
        'turbulence': turbulence,
        'staffBehaviour': staffBehaviour,
        'cleanliness': cleanliness,
        'legroom': legroom,
        'bagSpace': bagSpace,
        if (comment != null && comment!.isNotEmpty) 'comment': comment,
        'createdAt': createdAt,
      };

  factory FlightRating.fromMap(Map<String, dynamic> map) => FlightRating(
        id: (map['id'] ?? map['_id'] ?? '').toString(),
        seat: (map['seat'] ?? '').toString(),
        flightId: (map['flightId'] ?? 'BA123').toString(),
        flightDate: (map['flightDate'] ?? '31/10/2026').toString(),
        turbulence: (map['turbulence'] as num?)?.toInt() ?? 3,
        staffBehaviour: (map['staffBehaviour'] as num?)?.toInt() ?? 3,
        cleanliness: (map['cleanliness'] as num?)?.toInt() ?? 3,
        legroom: (map['legroom'] as num?)?.toInt() ?? 3,
        bagSpace: (map['bagSpace'] as num?)?.toInt() ?? 3,
        comment: map['comment']?.toString(),
        createdAt: (map['createdAt'] as num?)?.toInt() ??
            DateTime.now().millisecondsSinceEpoch,
      );
}

class SeatComplaint {
  final String id;
  final String fromSeat;
  final String targetSeat;
  final String flightId;
  final String flightDate;
  final String category;
  final String text;
  final int createdAt;

  const SeatComplaint({
    required this.id,
    required this.fromSeat,
    required this.targetSeat,
    this.flightId = 'BA123',
    this.flightDate = '31/10/2026',
    required this.category,
    required this.text,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'fromSeat': fromSeat,
        'targetSeat': targetSeat,
        'flightId': flightId,
        'flightDate': flightDate,
        'category': category,
        'text': text,
        'createdAt': createdAt,
      };

  factory SeatComplaint.fromMap(Map<String, dynamic> map) => SeatComplaint(
        id: (map['id'] ?? map['_id'] ?? '').toString(),
        fromSeat: (map['fromSeat'] ?? '').toString(),
        targetSeat: (map['targetSeat'] ?? '').toString(),
        flightId: (map['flightId'] ?? 'BA123').toString(),
        flightDate: (map['flightDate'] ?? '31/10/2026').toString(),
        category: (map['category'] ?? 'noise').toString(),
        text: (map['text'] ?? '').toString(),
        createdAt: (map['createdAt'] as num?)?.toInt() ??
            DateTime.now().millisecondsSinceEpoch,
      );
}

class PassengerRating {
  final String id;
  final String seat;
  final String flightId;
  final String flightDate;
  final int score;
  final String note;
  final int createdAt;

  const PassengerRating({
    required this.id,
    required this.seat,
    this.flightId = 'BA123',
    this.flightDate = '31/10/2026',
    required this.score,
    required this.note,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        '_id': id,
        'id': id,
        'seat': seat,
        'flightId': flightId,
        'flightDate': flightDate,
        'score': score,
        'note': note,
        'createdAt': createdAt,
      };

  factory PassengerRating.fromMap(Map<String, dynamic> map) => PassengerRating(
        id: (map['id'] ?? map['_id'] ?? '').toString(),
        seat: (map['seat'] ?? '').toString(),
        flightId: (map['flightId'] ?? 'BA123').toString(),
        flightDate: (map['flightDate'] ?? '31/10/2026').toString(),
        score: (map['score'] as num?)?.toInt() ?? 3,
        note: (map['note'] ?? '').toString(),
        createdAt: (map['createdAt'] as num?)?.toInt() ??
            DateTime.now().millisecondsSinceEpoch,
      );
}

class MenuProduct {
  final String name;
  final String detail;
  final int priceCents;
  final String category;
  final String imageAsset;

  const MenuProduct({
    required this.name,
    required this.detail,
    required this.priceCents,
    required this.category,
    required this.imageAsset,
  });
}

const List<MenuProduct> kMenuProducts = [
  MenuProduct(name: 'Coca-Cola Original', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-cola.jpg'),
  MenuProduct(name: 'Coca-Cola Zero Sugar', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-cola-zero.jpg'),
  MenuProduct(name: 'Fanta Orange', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-fanta.jpg'),
  MenuProduct(name: 'Sprite Lemon-Lime', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-sprite.jpg'),
  MenuProduct(name: 'Pepsi', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-pepsi.jpg'),
  MenuProduct(name: '7UP', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-7up.jpg'),
  MenuProduct(name: 'evian', detail: '500 ml', priceCents: 250, category: 'drinks', imageAsset: 'assets/images/menu-evian.jpg'),
  MenuProduct(name: 'Perrier', detail: '330 ml', priceCents: 350, category: 'drinks', imageAsset: 'assets/images/menu-perrier.jpg'),
  MenuProduct(name: 'San Pellegrino Aranciata', detail: '330 ml', priceCents: 350, category: 'drinks', imageAsset: 'assets/images/menu-sanpellegrino.jpg'),
  MenuProduct(name: 'Capri-Sun Apple', detail: '200 ml', priceCents: 250, category: 'drinks', imageAsset: 'assets/images/menu-caprisun.jpg'),
  MenuProduct(name: 'Lay’s Classic', detail: '40 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-lays.jpg'),
  MenuProduct(name: 'Lay’s Paprika', detail: '40 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-lays-paprika.jpg'),
  MenuProduct(name: 'Pringles Original', detail: '40 g', priceCents: 300, category: 'snacks', imageAsset: 'assets/images/menu-pringles.jpg'),
  MenuProduct(name: 'Doritos Nacho Cheese', detail: '45 g', priceCents: 300, category: 'snacks', imageAsset: 'assets/images/menu-doritos.jpg'),
  MenuProduct(name: 'Chio Tortillas Cheese', detail: '40 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-chio.jpg'),
  MenuProduct(name: 'Oreo Original', detail: '66 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-oreo.jpg'),
  MenuProduct(name: 'Snickers', detail: '50 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-snickers.jpg'),
  MenuProduct(name: 'M&M’s Peanut', detail: '45 g', priceCents: 300, category: 'snacks', imageAsset: 'assets/images/menu-mms.jpg'),
  MenuProduct(name: 'KitKat', detail: '45 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-kitkat.jpg'),
  MenuProduct(name: 'Twix', detail: '50 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-twix.jpg'),
  MenuProduct(name: 'Red Bull Original', detail: '250 ml', priceCents: 450, category: 'drinks', imageAsset: 'assets/images/menu-redbull.jpg'),
  MenuProduct(name: 'Lipton Ice Tea Peach', detail: '500 ml', priceCents: 350, category: 'drinks', imageAsset: 'assets/images/menu-lipton.jpg'),
  MenuProduct(name: 'Starbucks Frappuccino', detail: '250 ml', priceCents: 500, category: 'drinks', imageAsset: 'assets/images/menu-starbucks.jpg'),
  MenuProduct(name: 'innocent Smooth Orange', detail: '330 ml', priceCents: 400, category: 'drinks', imageAsset: 'assets/images/menu-innocent.jpg'),
  MenuProduct(name: 'Schweppes Indian Tonic', detail: '330 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-schweppes.jpg'),
  MenuProduct(name: 'Haribo Goldbears', detail: '100 g', priceCents: 300, category: 'snacks', imageAsset: 'assets/images/menu-haribo.jpg'),
  MenuProduct(name: 'Kinder Bueno', detail: '43 g', priceCents: 300, category: 'snacks', imageAsset: 'assets/images/menu-kinder.jpg'),
  MenuProduct(name: 'Milka Alpine Milk', detail: '100 g', priceCents: 400, category: 'snacks', imageAsset: 'assets/images/menu-milka.jpg'),
  MenuProduct(name: 'Nutella & Go', detail: '52 g', priceCents: 350, category: 'snacks', imageAsset: 'assets/images/menu-nutella.jpg'),
  MenuProduct(name: 'Nature Valley Oats & Honey', detail: '42 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-naturevalley.jpg'),
  MenuProduct(name: 'Monster Energy', detail: '500 ml', priceCents: 400, category: 'drinks', imageAsset: 'assets/images/menu-monster.jpg'),
  MenuProduct(name: 'Fuze Tea Lemon', detail: '500 ml', priceCents: 300, category: 'drinks', imageAsset: 'assets/images/menu-fuzetea.jpg'),
  MenuProduct(name: 'Tropicana Orange', detail: '330 ml', priceCents: 350, category: 'drinks', imageAsset: 'assets/images/menu-tropicana.jpg'),
  MenuProduct(name: 'Heineken 0.0', detail: '330 ml', priceCents: 400, category: 'drinks', imageAsset: 'assets/images/menu-heineken.jpg'),
  MenuProduct(name: 'Nescafé Xpress Latte', detail: '250 ml', priceCents: 400, category: 'drinks', imageAsset: 'assets/images/menu-nescafe.jpg'),
  MenuProduct(name: 'Toblerone', detail: '100 g', priceCents: 450, category: 'snacks', imageAsset: 'assets/images/menu-toblerone.jpg'),
  MenuProduct(name: 'Bounty', detail: '57 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-bounty.jpg'),
  MenuProduct(name: 'Mars', detail: '51 g', priceCents: 250, category: 'snacks', imageAsset: 'assets/images/menu-mars.jpg'),
  MenuProduct(name: 'Lindt Lindor Milk', detail: '100 g', priceCents: 600, category: 'snacks', imageAsset: 'assets/images/menu-lindor.jpg'),
  MenuProduct(name: 'Pringles Sour Cream & Onion', detail: '40 g', priceCents: 300, category: 'snacks', imageAsset: 'assets/images/menu-pringles-sco.jpg'),
];

int cartTotalCents(Map<String, int> cart) {
  int total = 0;
  for (final product in kMenuProducts) {
    final qty = cart[product.name] ?? 0;
    if (qty > 0) {
      total += product.priceCents * qty;
    }
  }
  return total;
}

int orderItemsTotalCents(List<OrderItem> items) {
  final map = <String, int>{};
  for (final item in items) {
    map[item.name] = (map[item.name] ?? 0) + item.qty;
  }
  return cartTotalCents(map);
}

String formatPrice(int cents, [bool ro = false]) {
  final euros = (cents / 100.0).toStringAsFixed(2);
  if (ro) {
    return '${euros.replaceAll('.', ',')} €';
  }
  return '€$euros';
}

const List<Passenger> kRegisteredPassengers = [
  Passenger(
    id: 'p_popa_andreea',
    name: 'Popa Andreea',
    seat: 'C10',
    flightId: 'BA123',
    flightDate: '31/10/2026',
    medicalConditions: ['Asthma'],
  ),
  Passenger(
    id: 'p_radoi_laura',
    name: 'Radoi Laura',
    seat: 'D5',
    flightId: 'BA123',
    flightDate: '31/10/2026',
    medicalConditions: ['Diabetes'],
  ),
];

const StewardAccount kRegisteredSteward = StewardAccount(
  id: 'steward_patrutbm5d',
  username: 'patrutbm5d',
  password: '123456',
  flightNumber: 'BA123',
  flightDate: '31/10/2026',
  fullName: 'Patrut B.',
);

Passenger? validatePassengerCredentials({
  required String name,
  required String flightNumber,
  required String flightDate,
  required String seatNumber,
}) {
  final normInputWords = name
      .trim()
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .toList()
    ..sort();
  final normFlight = flightNumber.trim().toUpperCase();
  final normDate = flightDate.trim();
  final normSeat = normalizeSeatCode(seatNumber);

  for (final p in kRegisteredPassengers) {
    final normTargetWords = p.name
        .trim()
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .toList()
      ..sort();
    final sameName = normInputWords.join(' ') == normTargetWords.join(' ');
    if (sameName &&
        p.flightId.toUpperCase() == normFlight &&
        p.flightDate == normDate &&
        normalizeSeatCode(p.seat) == normSeat) {
      return p;
    }
  }
  return null;
}

StewardAccount? validateStewardCredentials({
  required String username,
  required String password,
}) {
  if (username.trim() == kRegisteredSteward.username &&
      password.trim() == kRegisteredSteward.password) {
    return kRegisteredSteward;
  }
  return null;
}
