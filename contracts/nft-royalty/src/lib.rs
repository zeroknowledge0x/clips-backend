// Soroban NFT Contract with Platform Fee Tracking
// This contract implements ERC-721-like NFT functionality with royalty payments
// and transparent platform fee tracking.

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Vec, Map,
};

/// Storage key for the total accumulated platform fees
const TOTAL_PLATFORM_FEES: &str = "total_platform_fees";

/// Platform fee percentage in basis points (e.g., 500 = 5%)
const PLATFORM_FEE_BPS: u32 = 500; // 5% platform fee

#[contracttype]
#[derive(Clone)]
pub struct RoyaltyInfo {
    pub recipient: Address,
    pub bps: u32, // basis points (e.g., 1000 = 10%)
}

#[contracttype]
#[derive(Clone)]
pub struct NFTMetadata {
    pub owner: Address,
    pub uri: String,
    pub royalty_info: RoyaltyInfo,
}

#[contracttype]
pub enum DataKey {
    TokenOwner(u128),
    TokenURI(u128),
    TokenRoyalty(u128),
    TotalSupply,
}

/// Event emitted when platform fees are collected
#[contracttype]
#[derive(Clone)]
pub struct PlatformFeeCollected {
    pub amount: i128,
    pub new_total: u128,
}

#[contract]
pub struct NFTContract;

#[contractimpl]
impl NFTContract {
    /// Mint a new NFT with royalty information
    pub fn mint(
        env: Env,
        to: Address,
        token_id: u128,
        uri: String,
        royalty_recipient: Address,
        royalty_bps: u32,
    ) {
        to.require_auth();
        
        // Validate royalty BPS (max 15%)
        assert!(royalty_bps <= 1500, "Royalty BPS cannot exceed 1500 (15%)");
        
        // Store token owner
        env.storage().instance().set(&DataKey::TokenOwner(token_id), &to);
        
        // Store token URI
        env.storage().instance().set(&DataKey::TokenURI(token_id), &uri);
        
        // Store royalty info
        let royalty_info = RoyaltyInfo {
            recipient: royalty_recipient,
            bps: royalty_bps,
        };
        env.storage().instance().set(&DataKey::TokenRoyalty(token_id), &royalty_info);
        
        // Increment total supply
        let total_supply: u128 = env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply + 1));
    }

    /// Get the owner of a token
    pub fn owner_of(env: Env, token_id: u128) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist")
    }

    /// Get royalty information for a token
    pub fn get_royalties(env: Env, token_id: u128) -> Map<Address, u32> {
        let royalty_info: RoyaltyInfo = env.storage()
            .instance()
            .get(&DataKey::TokenRoyalty(token_id))
            .expect("Token does not exist");
        
        let mut royalty_map = Map::new(&env);
        royalty_map.set(royalty_info.recipient, royalty_info.bps);
        royalty_map
    }


    /// Execute a royalty payment for a token sale
    /// This function:
    /// 1. Calculates the royalty amount based on the token's royalty BPS
    /// 2. Calculates the platform fee (5% of sale price)
    /// 3. Transfers royalty to the creator
    /// 4. Transfers platform fee to the platform wallet
    /// 5. Atomically updates total_platform_fees
    /// 6. Emits PlatformFeeCollected event
    ///
    /// @param token_id - The NFT token ID
    /// @param sale_price - The sale price in stroops (1 XLM = 10^7 stroops)
    /// @param payment_token - The token contract address for payment
    /// @param buyer - The buyer's address (payer)
    /// @param platform_wallet - The platform's wallet address
    pub fn execute_royalty_payment(
        env: Env,
        token_id: u128,
        sale_price: i128,
        payment_token: Address,
        buyer: Address,
        platform_wallet: Address,
    ) {
        buyer.require_auth();
        
        // Ensure sale price is positive
        assert!(sale_price > 0, "Sale price must be positive");
        
        // Get royalty info
        let royalty_info: RoyaltyInfo = env.storage()
            .instance()
            .get(&DataKey::TokenRoyalty(token_id))
            .expect("Token does not exist");
        
        // Calculate royalty amount (creator's share)
        let royalty_amount = (sale_price * royalty_info.bps as i128) / 10000;
        
        // Calculate platform fee (5% of sale price)
        let platform_fee_amount = (sale_price * PLATFORM_FEE_BPS as i128) / 10000;
        
        // Calculate seller's net amount
        let seller_amount = sale_price - royalty_amount - platform_fee_amount;
        
        // Get token contract for transfers
        let token_client = token::Client::new(&env, &payment_token);
        
        // Transfer royalty to creator
        if royalty_amount > 0 {
            token_client.transfer(&buyer, &royalty_info.recipient, &royalty_amount);
        }
        
        // Transfer platform fee to platform wallet
        // This MUST happen atomically - cannot be skipped
        if platform_fee_amount > 0 {
            token_client.transfer(&buyer, &platform_wallet, &platform_fee_amount);
            
            // *** CRITICAL: Update total_platform_fees atomically ***
            // This increment happens in the same transaction as the payment
            // and cannot be skipped or made conditional
            let current_total: u128 = env.storage()
                .persistent()
                .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
                .unwrap_or(0);
            
            let new_total = current_total + platform_fee_amount as u128;
            
            env.storage()
                .persistent()
                .set(&String::from_str(&env, TOTAL_PLATFORM_FEES), &new_total);
            
            // Emit event for off-chain indexers
            env.events().publish(
                (String::from_str(&env, "PlatformFeeCollected"),),
                PlatformFeeCollected {
                    amount: platform_fee_amount,
                    new_total,
                },
            );
        }
        
        // Transfer remaining amount to seller (current token owner)
        let seller = Self::owner_of(env.clone(), token_id);
        if seller_amount > 0 {
            token_client.transfer(&buyer, &seller, &seller_amount);
        }
    }

    /// Get the total accumulated platform revenue
    /// This is a read-only function with no access control - anyone can call it
    /// for transparency.
    ///
    /// @return The total platform fees collected in stroops (1 XLM = 10^7 stroops)
    pub fn get_platform_revenue(env: Env) -> u128 {
        env.storage()
            .persistent()
            .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
            .unwrap_or(0)
    }

    /// Transfer token ownership (standard ERC-721 transfer)
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u128) {
        from.require_auth();
        
        let current_owner: Address = env.storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist");
        
        assert!(current_owner == from, "Not the token owner");
        
        env.storage().instance().set(&DataKey::TokenOwner(token_id), &to);
    }

    /// Get token URI
    pub fn token_uri(env: Env, token_id: u128) -> String {
        env.storage()
            .instance()
            .get(&DataKey::TokenURI(token_id))
            .expect("Token does not exist")
    }

    /// Get total supply of minted tokens
    pub fn total_supply(env: Env) -> u128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_platform_fee_tracking() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        let platform = Address::generate(&env);
        let token_address = Address::generate(&env);

        // Initial platform revenue should be 0
        assert_eq!(client.get_platform_revenue(), 0);

        // Mint a token with 10% royalty
        client.mint(
            &creator,
            &1,
            &String::from_str(&env, "ipfs://test"),
            &creator,
            &1000,
        );

        // Execute royalty payment with 100 XLM sale (1,000,000,000 stroops)
        // Platform fee: 5% = 50,000,000 stroops
        // Royalty: 10% = 100,000,000 stroops
        client.execute_royalty_payment(
            &1,
            &1_000_000_000,
            &token_address,
            &buyer,
            &platform,
        );

        // Platform revenue should now be 50,000,000
        assert_eq!(client.get_platform_revenue(), 50_000_000);

        // Execute another payment
        client.execute_royalty_payment(
            &1,
            &2_000_000_000,
            &token_address,
            &buyer,
            &platform,
        );

        // Platform revenue should accumulate: 50M + 100M = 150M
        assert_eq!(client.get_platform_revenue(), 150_000_000);
    }

    #[test]
    fn test_mint_and_royalty() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_id = 1u128;

        client.mint(
            &creator,
            &token_id,
            &String::from_str(&env, "ipfs://metadata"),
            &creator,
            &1000, // 10% royalty
        );

        assert_eq!(client.owner_of(&token_id), creator);
        assert_eq!(client.total_supply(), 1);

        let royalties = client.get_royalties(&token_id);
        assert_eq!(royalties.get(creator).unwrap(), 1000);
    }
}
