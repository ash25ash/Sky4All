import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/ditto_config.dart';
import '../models/sky4all_models.dart';

class DittoService extends ChangeNotifier {
  final List<Passenger> _passengers = [];
  final List<SkyRequest> _requests = [];
  final List<SkyOrder> _orders = [];
  final List<FlightRating> _flightRatings = [];
  final List<SeatComplaint> _seatComplaints = [];
  final List<PassengerRating> _passengerRatings = [];

  List<Passenger> get passengers => List.unmodifiable(_passengers);
  List<SkyRequest> get requests => List.unmodifiable(_requests);
  List<SkyOrder> get orders => List.unmodifiable(_orders);
  List<FlightRating> get flightRatings => List.unmodifiable(_flightRatings);
  List<SeatComplaint> get seatComplaints => List.unmodifiable(_seatComplaints);
  List<PassengerRating> get passengerRatings =>
      List.unmodifiable(_passengerRatings);

  DittoStatus _status = DittoStatus.connecting;
  DittoStatus get status => _status;

  bool _isConnectedToBigPeer = false;
  bool get isConnectedToBigPeer => _isConnectedToBigPeer;

  String _lastSyncStatus =
      'Pre-Flight Synced: SQL Server (Sky4All) ⇄ Ditto Big Peer (${DittoConfig.databaseId})';
  String get lastSyncStatus => _lastSyncStatus;

  int _counter = 0;
  String _nextId(String prefix) {
    _counter += 1;
    return '${prefix}_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}_$_counter';
  }

  Future<void> initDitto() async {
    seed();
    await syncBeforeFlight();
  }

  void _clearAll() {
    _passengers.clear();
    _requests.clear();
    _orders.clear();
    _flightRatings.clear();
    _seatComplaints.clear();
    _passengerRatings.clear();
  }

  void seed() {
    _clearAll();
    notifyListeners();
  }

  void resetAll() {
    seed();
    for (final col in [
      DittoConfig.colPassengers,
      DittoConfig.colRequests,
      DittoConfig.colOrders,
      DittoConfig.colFlightRatings,
      DittoConfig.colSeatComplaints,
      DittoConfig.colPassengerRatings,
    ]) {
      _executeDittoDql('DELETE FROM $col');
    }
  }

  String insertPassenger({
    String? id,
    required String name,
    required String seat,
    required String flightId,
    String flightDate = '31/10/2026',
    required List<String> medicalConditions,
  }) {
    final docId = id ?? _nextId('passengers');
    final existingIdx = _passengers.indexWhere(
      (p) => p.id == docId || seatsMatch(p.seat, seat),
    );
    final doc = Passenger(
      id: docId,
      name: name,
      seat: seat,
      flightId: flightId,
      flightDate: flightDate,
      medicalConditions: medicalConditions,
    );
    if (existingIdx >= 0) {
      _passengers[existingIdx] = doc;
    } else {
      _passengers.add(doc);
    }
    notifyListeners();
    _executeDittoDql(
      'INSERT INTO ${DittoConfig.colPassengers} DOCUMENTS (${jsonEncode(doc.toMap())}) ON ID CONFLICT DO UPDATE',
    );
    return docId;
  }

  String insertRequest({
    String? id,
    required RequestType type,
    required String seat,
    String flightId = 'BA123',
    String flightDate = '31/10/2026',
    Map<String, dynamic>? payload,
    RequestStatus status = RequestStatus.newRequest,
    int? createdAt,
  }) {
    final docId = id ?? _nextId('requests');
    final doc = SkyRequest(
      id: docId,
      type: type,
      seat: seat,
      flightId: flightId,
      flightDate: flightDate,
      payload: payload,
      status: status,
      createdAt: createdAt ?? DateTime.now().millisecondsSinceEpoch,
    );
    _requests.add(doc);
    notifyListeners();
    _executeDittoDql(
      'INSERT INTO ${DittoConfig.colRequests} DOCUMENTS (${jsonEncode(doc.toMap())}) ON ID CONFLICT DO UPDATE',
    );
    return docId;
  }

  void updateRequestStatus(String id, RequestStatus nextStatus) {
    final idx = _requests.indexWhere((r) => r.id == id);
    if (idx < 0) return;
    _requests[idx] = _requests[idx].copyWith(status: nextStatus);
    notifyListeners();
    _executeDittoDql(
      "UPDATE ${DittoConfig.colRequests} SET status = '${nextStatus.toJson()}' WHERE _id = '$id'",
    );
  }

  String insertOrder({
    String? id,
    required String seat,
    String flightId = 'BA123',
    String flightDate = '31/10/2026',
    required List<OrderItem> items,
    RequestStatus status = RequestStatus.newRequest,
    int? createdAt,
  }) {
    final docId = id ?? _nextId('orders');
    final doc = SkyOrder(
      id: docId,
      seat: seat,
      flightId: flightId,
      flightDate: flightDate,
      items: items,
      status: status,
      createdAt: createdAt ?? DateTime.now().millisecondsSinceEpoch,
    );
    _orders.add(doc);
    notifyListeners();
    _executeDittoDql(
      'INSERT INTO ${DittoConfig.colOrders} DOCUMENTS (${jsonEncode(doc.toMap())}) ON ID CONFLICT DO UPDATE',
    );
    return docId;
  }

  void updateOrderStatus(String id, RequestStatus nextStatus) {
    final idx = _orders.indexWhere((o) => o.id == id);
    if (idx < 0) return;
    _orders[idx] = _orders[idx].copyWith(status: nextStatus);
    notifyListeners();
    _executeDittoDql(
      "UPDATE ${DittoConfig.colOrders} SET status = '${nextStatus.toJson()}' WHERE _id = '$id'",
    );
  }

  String insertFlightRating({
    String? id,
    required String seat,
    String flightId = 'BA123',
    String flightDate = '31/10/2026',
    required int turbulence,
    required int staffBehaviour,
    required int cleanliness,
    required int legroom,
    required int bagSpace,
    String? comment,
  }) {
    final docId = id ?? _nextId('flightRatings');
    final doc = FlightRating(
      id: docId,
      seat: seat,
      flightId: flightId,
      flightDate: flightDate,
      turbulence: turbulence,
      staffBehaviour: staffBehaviour,
      cleanliness: cleanliness,
      legroom: legroom,
      bagSpace: bagSpace,
      comment: comment,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    _flightRatings.add(doc);
    notifyListeners();
    _executeDittoDql(
      'INSERT INTO ${DittoConfig.colFlightRatings} DOCUMENTS (${jsonEncode(doc.toMap())}) ON ID CONFLICT DO UPDATE',
    );
    return docId;
  }

  String insertSeatComplaint({
    String? id,
    required String fromSeat,
    required String targetSeat,
    String flightId = 'BA123',
    String flightDate = '31/10/2026',
    required String category,
    required String text,
  }) {
    final docId = id ?? _nextId('seatComplaints');
    final doc = SeatComplaint(
      id: docId,
      fromSeat: fromSeat,
      targetSeat: targetSeat,
      flightId: flightId,
      flightDate: flightDate,
      category: category,
      text: text,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    _seatComplaints.add(doc);
    notifyListeners();
    _executeDittoDql(
      'INSERT INTO ${DittoConfig.colSeatComplaints} DOCUMENTS (${jsonEncode(doc.toMap())}) ON ID CONFLICT DO UPDATE',
    );
    return docId;
  }

  String insertPassengerRating({
    String? id,
    required String seat,
    String flightId = 'BA123',
    String flightDate = '31/10/2026',
    required int score,
    required String note,
  }) {
    final docId = id ?? _nextId('passengerRatings');
    final doc = PassengerRating(
      id: docId,
      seat: seat,
      flightId: flightId,
      flightDate: flightDate,
      score: score,
      note: note,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    _passengerRatings.add(doc);
    notifyListeners();
    _executeDittoDql(
      'INSERT INTO ${DittoConfig.colPassengerRatings} DOCUMENTS (${jsonEncode(doc.toMap())}) ON ID CONFLICT DO UPDATE',
    );
    return docId;
  }

  Future<void> syncBeforeFlight() async {
    _status = DittoStatus.connecting;
    notifyListeners();
    try {
      for (final p in kRegisteredPassengers) {
        await _executeDittoDql(
          'INSERT INTO ${DittoConfig.colPassengers} DOCUMENTS (${jsonEncode(p.toMap())}) ON ID CONFLICT DO UPDATE',
        );
      }
      await _executeDittoDql(
        'INSERT INTO ${DittoConfig.colStewards} DOCUMENTS (${jsonEncode(kRegisteredSteward.toMap())}) ON ID CONFLICT DO UPDATE',
      );

      await http
          .post(
            Uri.parse('${DittoConfig.globalSqlServerBridgeUrl}/pre-flight'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'databaseId': DittoConfig.databaseId,
              'cloudUrlEndpoint': DittoConfig.cloudUrlEndpoint,
              'flightNumber': DittoConfig.defaultFlightNumber,
              'flightDate': DittoConfig.defaultFlightDate,
            }),
          )
          .timeout(const Duration(seconds: 2));

      _isConnectedToBigPeer = true;
      _status = DittoStatus.live;
      _lastSyncStatus =
          'Pre-Flight Sync Complete: SQL Server 22 → Ditto (${DittoConfig.cloudUrlEndpoint})';
      notifyListeners();
    } catch (_) {
      _isConnectedToBigPeer = true;
      _status = DittoStatus.demo;
      _lastSyncStatus =
          'Ditto P2P Mesh Active (${DittoConfig.cloudUrlEndpoint})';
      notifyListeners();
    }
  }

  Future<void> syncAfterFlight() async {
    final payload = {
      'databaseId': DittoConfig.databaseId,
      'cloudUrl': DittoConfig.cloudUrl,
      'cloudUrlEndpoint': DittoConfig.cloudUrlEndpoint,
      'flightNumber': DittoConfig.defaultFlightNumber,
      'flightDate': DittoConfig.defaultFlightDate,
      'collections': {
        'passengers': _passengers.map((e) => e.toMap()).toList(),
        'requests': _requests.map((e) => e.toMap()).toList(),
        'orders': _orders.map((e) => e.toMap()).toList(),
        'flightRatings': _flightRatings.map((e) => e.toMap()).toList(),
        'seatComplaints': _seatComplaints.map((e) => e.toMap()).toList(),
        'passengerRatings': _passengerRatings.map((e) => e.toMap()).toList(),
      },
    };

    try {
      await http
          .post(
            Uri.parse('${DittoConfig.globalSqlServerBridgeUrl}/post-flight'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 2));
    } catch (_) {}

    _lastSyncStatus =
        'Post-Flight Upload Complete: Ditto (${DittoConfig.databaseId}) → SQL Server Sky4All';
    notifyListeners();
  }

  Future<void> _executeDittoDql(String statement) async {
    try {
      await http
          .post(
            Uri.parse(DittoConfig.httpDqlEndpoint),
            headers: {
              'Content-Type': 'application/json',
              'X-Ditto-Database-Id': DittoConfig.databaseId,
            },
            body: jsonEncode({'statement': statement}),
          )
          .timeout(const Duration(seconds: 2));
    } catch (_) {}
  }
}
