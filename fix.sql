-- Add 'referencia' to the allowed payment methods in the tickets table
ALTER TABLE tickets
DROP CONSTRAINT tickets_payment_method_check,
ADD CONSTRAINT tickets_payment_method_check
CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'bank_transfer', 'referencia'));

-- Add policy to allow payment API to create transactions
CREATE POLICY "Payment API can create transactions" ON payment_transactions
    FOR INSERT WITH CHECK (true);
