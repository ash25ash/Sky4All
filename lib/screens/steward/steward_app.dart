import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../config/ditto_config.dart';
import '../../models/sky4all_models.dart';
import '../../services/ditto_service.dart';
import '../../services/i18n_service.dart';
import '../../widgets/seat_map_widget.dart';

class StewardAppWidget extends StatefulWidget {
  final DittoService ditto;
  final I18nService i18n;

  const StewardAppWidget({
    super.key,
    required this.ditto,
    required this.i18n,
  });

  @override
  State<StewardAppWidget> createState() => _StewardAppWidgetState();
}

enum _StewardTab { urgent, calls, orders, complaints }

class _StewardAppWidgetState extends State<StewardAppWidget> {
  bool _loggedIn = false;
  final TextEditingController _userCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();
  String _autofilledFlightNumber = '';
  String _autofilledFlightDate = '';
  String? _loginError;

  _StewardTab _tab = _StewardTab.urgent;
  String? _selectedSeat;
  int _prevUrgentCount = 0;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  void _attemptStewardLogin() {
    final matched = validateStewardCredentials(
      username: _userCtrl.text,
      password: _passCtrl.text,
    );
    if (matched != null) {
      setState(() {
        _loggedIn = true;
        _loginError = null;
        _autofilledFlightNumber = matched.flightNumber;
        _autofilledFlightDate = matched.flightDate;
      });
    } else {
      setState(() {
        _loginError = widget.i18n.t('invalidCredentials');
      });
    }
  }

  void _logoutSteward() {
    setState(() {
      _loggedIn = false;
      _autofilledFlightNumber = '';
      _autofilledFlightDate = '';
      _userCtrl.clear();
      _passCtrl.clear();
    });
  }

  RequestStatus? _nextStatus(RequestStatus current) {
    switch (current) {
      case RequestStatus.newRequest:
        return RequestStatus.seen;
      case RequestStatus.seen:
        return RequestStatus.in_progress;
      case RequestStatus.in_progress:
        return RequestStatus.resolved;
      case RequestStatus.resolved:
        return null;
    }
  }

  void _advanceRequest(String id, RequestStatus status) {
    final next = _nextStatus(status);
    if (next != null) {
      widget.ditto.updateRequestStatus(id, next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;

    return Container(
      color: Sky4AllPalette.background,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.flight_takeoff,
                    size: 20,
                    color: Sky4AllPalette.primary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${t('appName')} · ${t('steward')}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Sky4AllPalette.primary,
                    ),
                  ),
                  if (_loggedIn) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: Sky4AllPalette.seatOk,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '$_autofilledFlightNumber · $_autofilledFlightDate',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Sky4AllPalette.seatOkForeground,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              Row(
                children: [
                  if (_loggedIn)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: InkWell(
                        onTap: _logoutSteward,
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            border: Border.all(color: Sky4AllPalette.border),
                            borderRadius: BorderRadius.circular(999),
                            color: Sky4AllPalette.card,
                          ),
                          child: const Icon(
                            Icons.logout,
                            size: 14,
                            color: Sky4AllPalette.primary,
                          ),
                        ),
                      ),
                    ),
                  LangSwitcher(i18n: widget.i18n),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (!_loggedIn)
            _buildStewardLoginCard(t)
          else
            _buildStewardDashboard(t),
        ],
      ),
    );
  }

  Widget _buildStewardLoginCard(String Function(String) t) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.badge_outlined, color: Sky4AllPalette.primary),
              const SizedBox(width: 8),
              Text(
                t('stewardLoginTitle'),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Sky4AllPalette.foreground,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _userCtrl,
            decoration: InputDecoration(
              labelText: t('username'),
              filled: true,
              fillColor: Sky4AllPalette.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _passCtrl,
            obscureText: true,
            decoration: InputDecoration(
              labelText: t('password'),
              filled: true,
              fillColor: Sky4AllPalette.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          if (_loginError != null) ...[
            const SizedBox(height: 8),
            Text(
              _loginError!,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Sky4AllPalette.seatUrgent,
              ),
            ),
          ],
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: _attemptStewardLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: Sky4AllPalette.primary,
              foregroundColor: Sky4AllPalette.primaryForeground,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              t('signIn'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStewardDashboard(String Function(String) t) {
    final requests = widget.ditto.requests;
    final orders = widget.ditto.orders;
    final complaints = widget.ditto.seatComplaints;
    final ratings = widget.ditto.flightRatings;
    final passengers = widget.ditto.passengers;

    final open =
        requests.where((r) => r.status != RequestStatus.resolved).toList();
    final urgent =
        open.where((r) => r.type == RequestType.medical_emergency).toList();
    final calls =
        open.where((r) => r.type == RequestType.call_steward).toList();
    final openOrders =
        orders.where((o) => o.status != RequestStatus.resolved).toList();

    if (urgent.length > _prevUrgentCount) {
      SystemSound.play(SystemSoundType.alert);
    }
    _prevUrgentCount = urgent.length;

    SeatStatus getSeatStatus(String seatCode) {
      final seatOpen = open.where((r) => seatsMatch(r.seat, seatCode)).toList();
      if (seatOpen.any(
        (r) =>
            r.type == RequestType.medical_emergency ||
            r.type == RequestType.call_steward,
      )) {
        return SeatStatus.urgent;
      }
      if (seatOpen.isNotEmpty ||
          complaints.any((c) => seatsMatch(c.targetSeat, seatCode))) {
        return SeatStatus.minor;
      }
      return SeatStatus.ok;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Sky4AllPalette.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Sky4AllPalette.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller:
                      TextEditingController(text: _autofilledFlightNumber),
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: t('flightNumberLabel'),
                    isDense: true,
                    filled: true,
                    fillColor: Sky4AllPalette.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller:
                      TextEditingController(text: _autofilledFlightDate),
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: t('flightDateLabel'),
                    isDense: true,
                    filled: true,
                    fillColor: Sky4AllPalette.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _buildTabButton(
              id: _StewardTab.urgent,
              label: t('urgent'),
              count: urgent.length,
              alert: urgent.isNotEmpty,
            ),
            const SizedBox(width: 8),
            _buildTabButton(
              id: _StewardTab.calls,
              label: t('calls'),
              count: calls.length,
            ),
            const SizedBox(width: 8),
            _buildTabButton(
              id: _StewardTab.orders,
              label: t('orders'),
              count: openOrders.length,
            ),
            const SizedBox(width: 8),
            _buildTabButton(
              id: _StewardTab.complaints,
              label: t('feedbackTab'),
              count: complaints.length + ratings.length,
            ),
          ],
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final isWide = constraints.maxWidth >= 560;
            final heatmapCard = Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Sky4AllPalette.card,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Center(
                child: SeatMapWidget(
                  compact: true,
                  getStatus: getSeatStatus,
                  selectedSeat: _selectedSeat,
                  onSeatClick: (s) => setState(() => _selectedSeat = s),
                ),
              ),
            );

            final rightColumn = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Sky4AllPalette.card,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: _buildActiveTabContent(
                    t: t,
                    urgent: urgent,
                    calls: calls,
                    openOrders: openOrders,
                    complaints: complaints,
                    ratings: ratings,
                  ),
                ),
                if (_selectedSeat != null) ...[
                  const SizedBox(height: 12),
                  _SeatPanelWidget(
                    seat: _selectedSeat!,
                    ditto: widget.ditto,
                    i18n: widget.i18n,
                    requests: requests
                        .where((r) => seatsMatch(r.seat, _selectedSeat!))
                        .toList(),
                    complaints: complaints
                        .where((c) => seatsMatch(c.targetSeat, _selectedSeat!))
                        .toList(),
                    ratings: const [],
                    passenger: passengers
                        .where((p) => seatsMatch(p.seat, _selectedSeat!))
                        .firstOrNull,
                    onClose: () => setState(() => _selectedSeat = null),
                    onAdvance: _advanceRequest,
                  ),
                ],
                const SizedBox(height: 12),
                _EndFlightButtonWidget(
                  ditto: widget.ditto,
                  i18n: widget.i18n,
                ),
              ],
            );

            if (isWide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  heatmapCard,
                  const SizedBox(width: 12),
                  Expanded(child: rightColumn),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                heatmapCard,
                const SizedBox(height: 12),
                rightColumn,
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildTabButton({
    required _StewardTab id,
    required String label,
    required int count,
    bool alert = false,
  }) {
    final active = _tab == id;
    return Expanded(
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          SizedBox(
            width: double.infinity,
            child: InkWell(
              onTap: () => setState(() => _tab = id),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: active ? Sky4AllPalette.primary : Sky4AllPalette.card,
                  borderRadius: BorderRadius.circular(12),
                  border: alert
                      ? Border.all(color: Sky4AllPalette.seatUrgent, width: 2)
                      : null,
                ),
                alignment: Alignment.center,
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: active
                        ? Sky4AllPalette.primaryForeground
                        : Sky4AllPalette.foreground,
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: -6,
            right: -4,
            child: Container(
              constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
              padding: const EdgeInsets.symmetric(horizontal: 5),
              decoration: BoxDecoration(
                color: alert
                    ? Sky4AllPalette.seatUrgent
                    : Sky4AllPalette.secondary,
                borderRadius: BorderRadius.circular(999),
              ),
              alignment: Alignment.center,
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: alert
                      ? Sky4AllPalette.seatUrgentForeground
                      : Sky4AllPalette.secondaryForeground,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveTabContent({
    required String Function(String) t,
    required List<SkyRequest> urgent,
    required List<SkyRequest> calls,
    required List<SkyOrder> openOrders,
    required List<SeatComplaint> complaints,
    required List<FlightRating> ratings,
  }) {
    final ro = widget.i18n.isRo;
    switch (_tab) {
      case _StewardTab.urgent:
        if (urgent.isEmpty) {
          return Text(
            t('emptyTab'),
            style: const TextStyle(
              fontSize: 13,
              color: Sky4AllPalette.mutedForeground,
            ),
          );
        }
        return Column(
          children: urgent
              .map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _RequestRowWidget(
                    r: r,
                    ditto: widget.ditto,
                    i18n: widget.i18n,
                    onAdvance: () => _advanceRequest(r.id, r.status),
                  ),
                ),
              )
              .toList(),
        );
      case _StewardTab.calls:
        if (calls.isEmpty) {
          return Text(
            t('emptyTab'),
            style: const TextStyle(
              fontSize: 13,
              color: Sky4AllPalette.mutedForeground,
            ),
          );
        }
        return Column(
          children: calls
              .map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _RequestRowWidget(
                    r: r,
                    ditto: widget.ditto,
                    i18n: widget.i18n,
                    onAdvance: () => _advanceRequest(r.id, r.status),
                  ),
                ),
              )
              .toList(),
        );
      case _StewardTab.orders:
        if (openOrders.isEmpty) {
          return Text(
            t('emptyTab'),
            style: const TextStyle(
              fontSize: 13,
              color: Sky4AllPalette.mutedForeground,
            ),
          );
        }
        return Column(
          children: openOrders.map((o) {
            final summary =
                o.items.map((i) => '${i.qty}× ${i.name}').join(', ');
            final totalCents = orderItemsTotalCents(o.items);
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Sky4AllPalette.secondary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          RichText(
                            text: TextSpan(
                              style: const TextStyle(
                                fontSize: 13,
                                color: Sky4AllPalette.foreground,
                              ),
                              children: [
                                TextSpan(
                                  text: '${o.seat}  ',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                TextSpan(
                                  text: summary,
                                  style: const TextStyle(
                                    color: Sky4AllPalette.mutedForeground,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Total: ${formatPrice(totalCents, ro)}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Sky4AllPalette.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (o.status == RequestStatus.newRequest)
                      InkWell(
                        onTap: () => widget.ditto
                            .updateOrderStatus(o.id, RequestStatus.seen),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Sky4AllPalette.primary,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            t('markSeen'),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Sky4AllPalette.primaryForeground,
                            ),
                          ),
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Sky4AllPalette.seatOk,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          t('seen'),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Sky4AllPalette.seatOkForeground,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      case _StewardTab.complaints:
        if (complaints.isEmpty && ratings.isEmpty) {
          return Text(
            t('emptyTab'),
            style: const TextStyle(
              fontSize: 13,
              color: Sky4AllPalette.mutedForeground,
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ...complaints.map((c) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Sky4AllPalette.secondary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            '${c.fromSeat} → ${c.targetSeat}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Sky4AllPalette.seatMinor,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              t(c.category),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Sky4AllPalette.seatMinorForeground,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (c.text.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          c.text,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Sky4AllPalette.mutedForeground,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
            if (ratings.isNotEmpty) ...[
              if (complaints.isNotEmpty) const SizedBox(height: 4),
              ...ratings.map((r) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Sky4AllPalette.secondary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              t('anonymous'),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '★ ${r.average.toStringAsFixed(1)}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Sky4AllPalette.primary,
                              ),
                            ),
                          ],
                        ),
                        if (r.comment != null && r.comment!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            '“${r.comment}”',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Sky4AllPalette.mutedForeground,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        );
    }
  }
}

class _RequestRowWidget extends StatelessWidget {
  final SkyRequest r;
  final DittoService ditto;
  final I18nService i18n;
  final VoidCallback onAdvance;

  const _RequestRowWidget({
    required this.r,
    required this.ditto,
    required this.i18n,
    required this.onAdvance,
  });

  @override
  Widget build(BuildContext context) {
    final t = i18n.t;
    final ro = i18n.isRo;
    final labelKey = r.type == RequestType.medical_emergency
        ? 'medicalEmergency'
        : r.type == RequestType.call_steward
            ? 'callSteward'
            : r.type == RequestType.order
                ? 'orderSnacks'
                : 'complaints';

    final emergencyText = r.payload?['emergency']?.toString();
    final conditions = (r.payload?['conditions'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    final rawOrderItems = (r.payload?['items'] as List<dynamic>?)
            ?.map((e) => OrderItem.fromMap(Map<String, dynamic>.from(e as Map)))
            .toList() ??
        [];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: r.type == RequestType.medical_emergency
            ? Sky4AllPalette.seatUrgent.withOpacity(0.15)
            : Sky4AllPalette.secondary,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      r.seat,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        t(labelKey),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (r.type == RequestType.medical_emergency &&
                    emergencyText != null &&
                    emergencyText.isNotEmpty)
                  Text(
                    emergencyText,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Sky4AllPalette.seatUrgent,
                    ),
                  ),
                if (r.type == RequestType.medical_emergency &&
                    conditions.isNotEmpty)
                  Text(
                    conditions.join(', '),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Sky4AllPalette.seatUrgent,
                    ),
                  ),
                if (r.type == RequestType.order && rawOrderItems.isNotEmpty) ...[
                  Text(
                    rawOrderItems
                        .map((i) => '${i.qty}× ${i.name}')
                        .join(', '),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Sky4AllPalette.mutedForeground,
                    ),
                  ),
                  Text(
                    'Total: ${formatPrice(orderItemsTotalCents(rawOrderItems), ro)}',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Sky4AllPalette.primary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (r.type == RequestType.order)
            r.status == RequestStatus.newRequest
                ? InkWell(
                    onTap: () =>
                        ditto.updateRequestStatus(r.id, RequestStatus.seen),
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Sky4AllPalette.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        t('markSeen'),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Sky4AllPalette.primaryForeground,
                        ),
                      ),
                    ),
                  )
                : Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Sky4AllPalette.seatOk,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      t('seen'),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Sky4AllPalette.seatOkForeground,
                      ),
                    ),
                  )
          else if (r.type == RequestType.medical_emergency ||
              r.type == RequestType.call_steward)
            r.status == RequestStatus.resolved
                ? Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Sky4AllPalette.seatOk,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      t('resolved'),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Sky4AllPalette.seatOkForeground,
                      ),
                    ),
                  )
                : InkWell(
                    onTap: () =>
                        ditto.updateRequestStatus(r.id, RequestStatus.resolved),
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Sky4AllPalette.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        t('resolve'),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Sky4AllPalette.primaryForeground,
                        ),
                      ),
                    ),
                  )
          else
            _StatusButtonWidget(
              status: r.status,
              i18n: i18n,
              onTap: onAdvance,
            ),
        ],
      ),
    );
  }
}

class _StatusButtonWidget extends StatelessWidget {
  final RequestStatus status;
  final I18nService i18n;
  final VoidCallback onTap;

  const _StatusButtonWidget({
    required this.status,
    required this.i18n,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final t = i18n.t;
    if (status == RequestStatus.resolved) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Sky4AllPalette.seatOk,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          t('resolved'),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Sky4AllPalette.seatOkForeground,
          ),
        ),
      );
    }

    final labelKey = status == RequestStatus.newRequest
        ? 'markSeen'
        : status == RequestStatus.seen
            ? 'startProgress'
            : 'resolve';

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Sky4AllPalette.primary,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          t(labelKey),
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Sky4AllPalette.primaryForeground,
          ),
        ),
      ),
    );
  }
}

class _SeatPanelWidget extends StatefulWidget {
  final String seat;
  final DittoService ditto;
  final I18nService i18n;
  final List<SkyRequest> requests;
  final List<SeatComplaint> complaints;
  final List<FlightRating> ratings;
  final Passenger? passenger;
  final VoidCallback onClose;
  final void Function(String id, RequestStatus status) onAdvance;

  const _SeatPanelWidget({
    required this.seat,
    required this.ditto,
    required this.i18n,
    required this.requests,
    required this.complaints,
    required this.ratings,
    required this.passenger,
    required this.onClose,
    required this.onAdvance,
  });

  @override
  State<_SeatPanelWidget> createState() => _SeatPanelWidgetState();
}

class _SeatPanelWidgetState extends State<_SeatPanelWidget> {
  int _score = 3;
  final TextEditingController _noteCtrl = TextEditingController();

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;
    final passengerRatings = widget.ditto.passengerRatings
        .where((r) => seatsMatch(r.seat, widget.seat))
        .toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Sky4AllPalette.foreground,
                    ),
                    children: [
                      TextSpan(text: '${t('requestsFor')} ${widget.seat}'),
                      if (widget.passenger != null)
                        TextSpan(
                          text: '  ${widget.passenger!.name}',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Sky4AllPalette.mutedForeground,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              InkWell(
                onTap: widget.onClose,
                child: const Text(
                  '✕',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Sky4AllPalette.primary,
                  ),
                ),
              ),
            ],
          ),
          if (widget.passenger != null &&
              widget.passenger!.medicalConditions.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Sky4AllPalette.seatUrgent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${t('medicalLabel')}: ${widget.passenger!.medicalConditions.join(', ')}',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Sky4AllPalette.seatUrgent,
                ),
              ),
            ),
          ],
          if (widget.requests.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...widget.requests.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: _RequestRowWidget(
                  r: r,
                  ditto: widget.ditto,
                  i18n: widget.i18n,
                  onAdvance: () => widget.onAdvance(r.id, r.status),
                ),
              ),
            ),
          ],
          if (widget.complaints.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...widget.complaints.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Sky4AllPalette.secondary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${t(c.category)} · ${c.fromSeat}: ${c.text}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
            ),
          ],
          if (widget.ratings.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              t('ratingHistory'),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            ...widget.ratings.map(
              (r) => Text(
                '★ ${r.average.toStringAsFixed(1)} ${t('avg')}${r.comment != null ? ' — “${r.comment}”' : ''}',
                style: const TextStyle(
                  fontSize: 12,
                  color: Sky4AllPalette.mutedForeground,
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: Sky4AllPalette.border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t('ratePassenger'),
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    DropdownButton<int>(
                      value: _score,
                      items: [1, 2, 3, 4, 5]
                          .map(
                            (n) => DropdownMenuItem(
                              value: n,
                              child: Text('$n'),
                            ),
                          )
                          .toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _score = v);
                      },
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _noteCtrl,
                        decoration: InputDecoration(
                          hintText: t('note'),
                          isDense: true,
                          filled: true,
                          fillColor: Sky4AllPalette.background,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () {
                        widget.ditto.insertPassengerRating(
                          seat: widget.seat,
                          score: _score,
                          note: _noteCtrl.text.trim(),
                        );
                        _noteCtrl.clear();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Sky4AllPalette.primary,
                        foregroundColor: Sky4AllPalette.primaryForeground,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      child: Text(
                        t('send'),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                ...passengerRatings.map(
                  (r) => Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '★ ${r.score} — ${r.note}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Sky4AllPalette.mutedForeground,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EndFlightButtonWidget extends StatefulWidget {
  final DittoService ditto;
  final I18nService i18n;

  const _EndFlightButtonWidget({
    required this.ditto,
    required this.i18n,
  });

  @override
  State<_EndFlightButtonWidget> createState() => _EndFlightButtonWidgetState();
}

class _EndFlightButtonWidgetState extends State<_EndFlightButtonWidget> {
  int? _progress;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startUpload() {
    setState(() => _progress = 0);
    widget.ditto.syncAfterFlight();
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 120), (timer) {
      if (!mounted) return;
      final next = ((_progress ?? 0) + 8).clamp(0, 100);
      setState(() => _progress = next);
      if (next >= 100) {
        timer.cancel();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: _progress == null
          ? ElevatedButton.icon(
              onPressed: _startUpload,
              icon: const Icon(Icons.cloud_upload_outlined, size: 18),
              label: Text(
                t('endFlight'),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Sky4AllPalette.primary,
                foregroundColor: Sky4AllPalette.primaryForeground,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            )
          : _progress! < 100
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      t('uploading'),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Sky4AllPalette.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: _progress! / 100.0,
                        minHeight: 12,
                        backgroundColor: Sky4AllPalette.secondary,
                        color: Sky4AllPalette.primary,
                      ),
                    ),
                  ],
                )
              : Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: Sky4AllPalette.seatOk,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    t('uploadComplete'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Sky4AllPalette.seatOkForeground,
                    ),
                  ),
                ),
    );
  }
}
