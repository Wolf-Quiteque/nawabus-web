-- Profiles table (extends Supabase auth)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'driver', 'passenger')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    date_of_birth DATE,
    national_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Companies table (for bus operators)
CREATE TABLE companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    license_number TEXT UNIQUE NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buses table
CREATE TABLE buses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) NOT NULL,
    license_plate TEXT UNIQUE NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    capacity INTEGER NOT NULL,
    amenities TEXT[], -- Array of amenities like ['wifi', 'ac', 'toilet']
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routes table
-- Routes table with base pricing
CREATE TABLE routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    origin_city TEXT NOT NULL,
    origin_province TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    destination_province TEXT NOT NULL,
    distance_km DECIMAL(8,2),
    estimated_duration_hours DECIMAL(4,2),
    typical_departure_times TIME[],
    base_price_usd DECIMAL(8,2) NOT NULL, -- Base price for this route
    is_international BOOLEAN DEFAULT false,
    border_crossings TEXT[], -- Array of border crossing points
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Route pricing table for different seat classes or seasons
CREATE TABLE route_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID REFERENCES routes(id) NOT NULL,
    seat_class TEXT NOT NULL CHECK (seat_class IN ('economy', 'business', 'first')),
    price_usd DECIMAL(8,2) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated Trips table (price now references route pricing)
CREATE TABLE trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID REFERENCES routes(id) NOT NULL,
    bus_id UUID REFERENCES buses(id) NOT NULL,
    driver_id UUID REFERENCES profiles(id) NOT NULL,
    seat_class TEXT NOT NULL CHECK (seat_class IN ('economy', 'business', 'first')),
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    price_usd DECIMAL(8,2) NOT NULL, -- Final price for this specific trip
    available_seats INTEGER NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'boarding', 'departed', 'arrived', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated Tickets table with seat class
CREATE TABLE tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) NOT NULL,
    passenger_id UUID REFERENCES profiles(id) NOT NULL,
    booked_by UUID REFERENCES profiles(id),
    booking_source TEXT NOT NULL DEFAULT 'agent' CHECK (booking_source IN ('online', 'agent', 'admin', 'mobile_app')),
    seat_class TEXT NOT NULL CHECK (seat_class IN ('economy', 'business', 'first')),
    seat_number INTEGER NOT NULL,
    ticket_number TEXT UNIQUE NOT NULL,
    qr_code_data TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled', 'refunded')),
    price_paid_usd DECIMAL(8,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'bank_transfer', 'referencia')),
    payment_reference TEXT,
    booking_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Passengers table (additional passenger info)
CREATE TABLE passengers (
    id UUID REFERENCES profiles(id) PRIMARY KEY,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    passport_number TEXT, -- Important for international travel
    nationality TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent locations table
CREATE TABLE agent_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES profiles(id) NOT NULL,
    location_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ticket scans table (for driver operations)
CREATE TABLE ticket_scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id) NOT NULL,
    driver_id UUID REFERENCES profiles(id) NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scan_location TEXT, -- GPS coordinates or location name
    scan_type TEXT CHECK (scan_type IN ('boarding', 'disembarking'))
);

-- Online bookings table for pending online reservations
CREATE TABLE online_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES trips(id) NOT NULL,
    passenger_id UUID REFERENCES profiles(id) NOT NULL,
    seat_number INTEGER NOT NULL,
    temporary_hold_id TEXT UNIQUE, -- For payment processing
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Hold expiration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment transactions table
CREATE TABLE payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id),
    amount_usd DECIMAL(8,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_method TEXT NOT NULL,
    transaction_id TEXT UNIQUE, -- From payment gateway
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    gateway_response JSONB, -- Raw response from payment gateway
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on new table
ALTER TABLE route_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read their own profile, admins can read all
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Companies: Only admins
CREATE POLICY "Admins can manage companies" ON companies
    FOR ALL USING (get_user_role() = 'admin');

-- Buses: Read access for agents and drivers, full access for admins
CREATE POLICY "Agents and drivers can view buses" ON buses
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage buses" ON buses
    FOR ALL USING (get_user_role() = 'admin');

-- Routes: Public read access
CREATE POLICY "Anyone can view routes" ON routes
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage routes" ON routes
    FOR ALL USING (get_user_role() = 'admin');

-- Trips: Agents can view, drivers can view their trips, admins can manage
CREATE POLICY "Agents can view trips" ON trips
    FOR SELECT USING (status != 'cancelled');

CREATE POLICY "Drivers can view their trips" ON trips
    FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Admins can manage trips" ON trips
    FOR ALL USING (get_user_role() = 'admin');

-- Tickets: Multiple policies for different operations
CREATE POLICY "Users can view own tickets" ON tickets
    FOR SELECT USING (passenger_id = auth.uid() OR booked_by = auth.uid());

CREATE POLICY "Agents can view all tickets" ON tickets
    FOR SELECT USING (get_user_role() IN ('agent', 'admin'));

CREATE POLICY "Agents can create tickets" ON tickets
    FOR INSERT WITH CHECK (get_user_role() IN ('agent', 'admin'));

CREATE POLICY "Users can create online tickets" ON tickets
    FOR INSERT WITH CHECK (
        booking_source IN ('online', 'mobile_app') AND 
        (booked_by = auth.uid() OR passenger_id = auth.uid())
    );

ALTER TABLE public.tickets
ADD CONSTRAINT fk_passenger_id
FOREIGN KEY (passenger_id) REFERENCES public.profiles(id);

CREATE POLICY "Admins can update tickets" ON tickets
    FOR UPDATE USING (get_user_role() = 'admin');

-- Passengers
CREATE POLICY "Users can view own passenger info" ON passengers
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can manage own passenger info" ON passengers
    FOR ALL USING (id = auth.uid());

-- Agent Locations
CREATE POLICY "Anyone can view active agent locations" ON agent_locations
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage agent locations" ON agent_locations
    FOR ALL USING (get_user_role() = 'admin');

-- Ticket Scans
CREATE POLICY "Drivers can create ticket scans" ON ticket_scans
    FOR INSERT WITH CHECK (get_user_role() = 'driver');

CREATE POLICY "Drivers can view their scans" ON ticket_scans
    FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Admins can view all scans" ON ticket_scans
    FOR SELECT USING (get_user_role() = 'admin');

-- Online Bookings
CREATE POLICY "Users can manage own online bookings" ON online_bookings
    FOR ALL USING (passenger_id = auth.uid());

CREATE POLICY "System can manage online bookings" ON online_bookings
    FOR ALL USING (true);

-- Payment Transactions
CREATE POLICY "Users can view own payment transactions" ON payment_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tickets 
            WHERE tickets.id = payment_transactions.ticket_id 
            AND (tickets.passenger_id = auth.uid() OR tickets.booked_by = auth.uid())
        )
    );

CREATE POLICY "Admins can view all payments" ON payment_transactions
    FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "Payment API can create transactions" ON payment_transactions
    FOR INSERT WITH CHECK (true);

-- Route pricing policies
CREATE POLICY "Anyone can view active route pricing" ON route_pricing
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage route pricing" ON route_pricing
    FOR ALL USING (get_user_role() = 'admin');

-- Functions and Triggers

-- Function to get current price for a route and seat class
CREATE OR REPLACE FUNCTION get_route_price(
    p_route_id UUID,
    p_seat_class TEXT DEFAULT 'economy'
)
RETURNS DECIMAL(8,2) AS $$
DECLARE
    v_price DECIMAL(8,2);
BEGIN
    SELECT price_usd INTO v_price
    FROM route_pricing
    WHERE route_id = p_route_id 
    AND seat_class = p_seat_class
    AND is_active = true
    AND effective_date <= CURRENT_DATE
    ORDER BY effective_date DESC
    LIMIT 1;
    
    IF v_price IS NULL THEN
        -- Fallback to base price from routes table
        SELECT base_price_usd INTO v_price
        FROM routes 
        WHERE id = p_route_id;
    END IF;
    
    RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to create trip with automatic pricing
CREATE OR REPLACE FUNCTION create_trip_with_pricing(
    p_route_id UUID,
    p_bus_id UUID,
    p_driver_id UUID,
    p_seat_class TEXT,
    p_departure_time TIMESTAMP WITH TIME ZONE,
    p_arrival_time TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
    v_trip_id UUID;
    v_price DECIMAL(8,2);
    v_capacity INTEGER;
BEGIN
    -- Get current price for the route and seat class
    v_price := get_route_price(p_route_id, p_seat_class);
    
    -- Get bus capacity
    SELECT capacity INTO v_capacity FROM buses WHERE id = p_bus_id;
    
    -- Create the trip
    INSERT INTO trips (
        route_id,
        bus_id,
        driver_id,
        seat_class,
        departure_time,
        arrival_time,
        price_usd,
        available_seats
    ) VALUES (
        p_route_id,
        p_bus_id,
        p_driver_id,
        p_seat_class,
        p_departure_time,
        p_arrival_time,
        v_price,
        v_capacity
    ) RETURNING id INTO v_trip_id;
    
    RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update trip prices when route pricing changes
CREATE OR REPLACE FUNCTION update_trip_prices_for_route(
    p_route_id UUID,
    p_seat_class TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE trips 
    SET price_usd = get_route_price(p_route_id, COALESCE(p_seat_class, trips.seat_class))
    WHERE route_id = p_route_id
    AND status IN ('scheduled', 'boarding')
    AND (p_seat_class IS NULL OR seat_class = p_seat_class);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_number := 'TKT-' || extract(year from now()) || '-' || 
                        lpad(floor(random() * 10000)::text, 4, '0') || '-' ||
                        substr(md5(random()::text), 1, 6);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ticket number generation
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();

-- Function to update available seats
CREATE OR REPLACE FUNCTION update_available_seats()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT: Only count paid tickets
    IF TG_OP = 'INSERT' AND NEW.payment_status = 'paid' THEN
        UPDATE trips 
        SET available_seats = available_seats - 1 
        WHERE id = NEW.trip_id;
    
    -- Handle UPDATE: When payment status changes to paid
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.payment_status != 'paid' AND NEW.payment_status = 'paid' THEN
            UPDATE trips 
            SET available_seats = available_seats - 1 
            WHERE id = NEW.trip_id;
        ELSIF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
            UPDATE trips 
            SET available_seats = available_seats + 1 
            WHERE id = NEW.trip_id;
        END IF;
    
    -- Handle DELETE: Only count if ticket was paid
    ELSIF TG_OP = 'DELETE' AND OLD.payment_status = 'paid' THEN
        UPDATE trips 
        SET available_seats = available_seats + 1 
        WHERE id = OLD.trip_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for seat management
CREATE TRIGGER update_seats_trigger
    AFTER INSERT OR UPDATE OF payment_status OR DELETE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_available_seats();

-- Function to initialize available seats when trip is created
CREATE OR REPLACE FUNCTION initialize_trip_seats()
RETURNS TRIGGER AS $$
BEGIN
    NEW.available_seats := (SELECT capacity FROM buses WHERE id = NEW.bus_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_trip_seats_trigger
    BEFORE INSERT ON trips
    FOR EACH ROW
    EXECUTE FUNCTION initialize_trip_seats();

-- Function to create a temporary seat hold for online booking
CREATE OR REPLACE FUNCTION create_seat_hold(
    p_trip_id UUID,
    p_passenger_id UUID,
    p_seat_number INTEGER,
    p_hold_duration_minutes INTEGER DEFAULT 15
)
RETURNS UUID AS $$
DECLARE
    v_hold_id UUID;
    v_expires_at TIMESTAMP;
BEGIN
    -- Check if seat is available
    IF EXISTS (
        SELECT 1 FROM tickets 
        WHERE trip_id = p_trip_id 
        AND seat_number = p_seat_number 
        AND status IN ('active', 'pending')
    ) OR EXISTS (
        SELECT 1 FROM online_bookings 
        WHERE trip_id = p_trip_id 
        AND seat_number = p_seat_number 
        AND expires_at > NOW()
    ) THEN
        RAISE EXCEPTION 'Seat not available';
    END IF;

    v_expires_at := NOW() + (p_hold_duration_minutes || ' minutes')::INTERVAL;
    
    INSERT INTO online_bookings (trip_id, passenger_id, seat_number, expires_at)
    VALUES (p_trip_id, p_passenger_id, p_seat_number, v_expires_at)
    RETURNING id INTO v_hold_id;
    
    RETURN v_hold_id;
END;
$$ LANGUAGE plpgsql;

-- Function to confirm online booking and create ticket
CREATE OR REPLACE FUNCTION confirm_online_booking(
    p_hold_id UUID,
    p_payment_method TEXT,
    p_payment_reference TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_booking online_bookings%ROWTYPE;
    v_ticket_id UUID;
BEGIN
    -- Get booking details
    SELECT * INTO v_booking FROM online_bookings 
    WHERE id = p_hold_id AND expires_at > NOW();
    
    IF v_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking hold expired or not found';
    END IF;

    -- Create ticket
    INSERT INTO tickets (
        trip_id,
        passenger_id,
        booked_by,
        booking_source,
        seat_class,
        seat_number,
        price_paid_usd,
        payment_status,
        payment_method,
        payment_reference
    )
    SELECT 
        v_booking.trip_id,
        v_booking.passenger_id,
        v_booking.passenger_id, -- booked_by is the passenger for online bookings
        'online',
        (SELECT seat_class FROM trips WHERE id = v_booking.trip_id), -- Get seat_class from trip
        v_booking.seat_number,
        trips.price_usd,
        'paid',
        p_payment_method,
        p_payment_reference
    FROM trips WHERE id = v_booking.trip_id
    RETURNING id INTO v_ticket_id;

    -- Record payment transaction
    INSERT INTO payment_transactions (
        ticket_id,
        amount_usd,
        payment_method,
        status,
        transaction_id
    )
    SELECT 
        v_ticket_id,
        tickets.price_paid_usd,
        p_payment_method,
        'completed',
        p_payment_reference
    FROM tickets WHERE id = v_ticket_id;

    -- Clean up the hold
    DELETE FROM online_bookings WHERE id = p_hold_id;
    
    RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired holds (run as cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM online_bookings 
    WHERE expires_at <= NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can access trip (for drivers)
CREATE OR REPLACE FUNCTION can_access_trip(trip_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM trips 
        WHERE id = trip_uuid 
        AND (
            driver_id = auth.uid() 
            OR get_user_role() IN ('admin', 'agent')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX idx_trips_route_departure ON trips(route_id, departure_time);
CREATE INDEX idx_tickets_trip_status ON tickets(trip_id, status);
CREATE INDEX idx_tickets_passenger ON tickets(passenger_id);
CREATE INDEX idx_tickets_qr_code ON tickets(qr_code_data);
CREATE INDEX idx_trips_driver_departure ON trips(driver_id, departure_time);
CREATE INDEX idx_ticket_scans_ticket_driver ON ticket_scans(ticket_id, driver_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_online_bookings_trip_seat ON online_bookings(trip_id, seat_number);
CREATE INDEX idx_online_bookings_expires ON online_bookings(expires_at);
CREATE INDEX idx_payments_ticket ON payment_transactions(ticket_id);
CREATE INDEX idx_tickets_booked_by ON tickets(booked_by);
CREATE INDEX idx_tickets_booking_source ON tickets(booking_source);

-- Auto-provision: ensure a profile row is created whenever a new auth user is created
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS create_profile_for_new_user_trigger ON auth.users;
CREATE TRIGGER create_profile_for_new_user_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();
