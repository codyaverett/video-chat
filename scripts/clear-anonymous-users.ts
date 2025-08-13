#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Script to clear anonymous users from the video chat database
 */

import { DatabaseService } from '../src/services/DatabaseService.ts';

function clearAnonymousUsers() {
  console.log('🚀 Starting anonymous users cleanup...');
  
  const db = new DatabaseService('./video-chat.db');
  
  try {
    // Get current stats
    const statsBefore = db.getStats();
    console.log(`📊 Before cleanup: ${statsBefore.users} total users, ${statsBefore.onlineUsers} online`);
    
    // Clear anonymous users
    const cleared = db.clearAnonymousUsers();
    
    // Get stats after cleanup
    const statsAfter = db.getStats();
    console.log(`📊 After cleanup: ${statsAfter.users} total users, ${statsAfter.onlineUsers} online`);
    console.log(`✅ Successfully cleared ${cleared} anonymous users`);
    
    // Run general maintenance while we're at it
    console.log('\n🔧 Running general database maintenance...');
    db.runMaintenance();
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    Deno.exit(1);
  } finally {
    db.close();
  }
  
  console.log('🎉 Cleanup complete!');
}

// Run if this script is executed directly
if (import.meta.main) {
  clearAnonymousUsers();
}